from flask import request
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson import ObjectId
from app.extensions import mongo
from app.services.external_api import ExternalAPI, parse_result
from app.models import ArtPiece
from app.services.logger_service import log_user_action
from pymongo.errors import DuplicateKeyError

api = Namespace("artpiece", description="Manage art pieces including CRUD and user collection actions.")

external_api = ExternalAPI("https://query.wikidata.org/sparql")

def is_admin():
    return get_jwt().get("role") == "admin"

def convert_objectid_to_str(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {k: convert_objectid_to_str(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_objectid_to_str(item) for item in obj]
    return obj

artpiece_model = api.model("ArtPiece", {
    "title": fields.String(required=True, description="Title of the art piece"),
    "author": fields.String(required=True, description="Author of the art piece"),
    "year": fields.Integer(description="Year created"),
    "style": fields.String(description="Artistic style"),
    "museum": fields.String(description="Museum where it's located"),
    "location": fields.String(description="Location details"),
    "medium": fields.String(description="Medium used (e.g., painting)"),
    "dimensions": fields.String(description="Size of the piece"),
    "image": fields.String(description="URL to image"),
    "description": fields.String(description="Detailed description"),
    "tags": fields.List(fields.String, description="Tags related to the piece"),
    "external_id": fields.String(description="External reference ID"),
    "source_url": fields.String(description="Source URL if fetched externally")
})

@api.route("/")
class ArtPieceList(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def get(self):
        identity = get_jwt_identity()
        query = request.args.get("query", "")
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
        skip = (page - 1) * limit

        results = list(mongo.db.artpieces.find().skip(skip).limit(limit))

        if not results and query:
            external_results = external_api.fetch_art_pieces(query, limit=limit)
            for result in external_results:
                artpiece = parse_result(result)
                try:
                    mongo.db.artpieces.insert_one(artpiece)
                    results.append(artpiece)
                except DuplicateKeyError:
                    existing = mongo.db.artpieces.find_one({"_id": artpiece["_id"]})
                    results.append(existing)
            log_user_action(identity, f"Searched external API for art pieces: '{query}'")
        else:
            log_user_action(identity, f"Viewed art pieces (query='{query}', page={page}, limit={limit})")

        return [convert_objectid_to_str(r) for r in results], 200

    @jwt_required()
    @api.expect(artpiece_model)
    @api.doc(security="Bearer Auth")
    def post(self):
        identity = get_jwt_identity()
        if not is_admin():
            return {"msg": "Unauthorized"}, 403

        data = request.get_json()
        artpiece = ArtPiece(data).to_dict()
        mongo.db.artpieces.insert_one(artpiece)
        log_user_action(identity, "Added new art piece")
        return {"msg": "Art piece added successfully"}, 201

@api.route("/<string:artpiece_id>")
class ArtPieceById(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def get(self, artpiece_id):
        identity = get_jwt_identity()
        artpiece = mongo.db.artpieces.find_one({"_id": ObjectId(artpiece_id)})
        if not artpiece:
            return {"msg": "Art piece not found"}, 404

        log_user_action(identity, f"Viewed art piece {artpiece_id}")
        return convert_objectid_to_str(artpiece), 200

    @jwt_required()
    @api.expect(artpiece_model)
    @api.doc(security="Bearer Auth")
    def put(self, artpiece_id):
        identity = get_jwt_identity()
        if not is_admin():
            return {"msg": "Unauthorized"}, 403

        data = request.get_json()
        result = mongo.db.artpieces.update_one(
            {"_id": ObjectId(artpiece_id)},
            {"$set": data}
        )

        if result.matched_count == 0:
            return {"msg": "Art piece not found"}, 404

        log_user_action(identity, f"Updated art piece {artpiece_id}")
        return {"msg": "Art piece updated"}, 200

    @jwt_required()
    @api.doc(security="Bearer Auth")
    def delete(self, artpiece_id):
        identity = get_jwt_identity()
        if not is_admin():
            return {"msg": "Unauthorized"}, 403

        result = mongo.db.artpieces.delete_one({"_id": ObjectId(artpiece_id)})
        if result.deleted_count == 0:
            return {"msg": "Art piece not found"}, 404

        log_user_action(identity, f"Deleted art piece {artpiece_id}")
        return {"msg": "Art piece deleted"}, 200

@api.route("/add_to_user")
class AddToUserCollection(Resource):
    @jwt_required()
    @api.expect(artpiece_model)
    @api.doc(security="Bearer Auth")
    def post(self):
        identity = get_jwt_identity()
        data = request.get_json()
        artpiece_data = ArtPiece(data).to_dict()

        existing = mongo.db.artpieces.find_one({
            "title": artpiece_data["title"],
            "author": artpiece_data["author"]
        })

        if existing:
            artpiece_id = str(existing["_id"])
        else:
            result = mongo.db.artpieces.insert_one(artpiece_data)
            artpiece_id = str(result.inserted_id)

        mongo.db.users.update_one(
            {"email": identity},
            {"$addToSet": {"artpieces": artpiece_id}}
        )

        log_user_action(identity, f"Added art piece {artpiece_id} to collection")
        return {"msg": "Art piece added", "artpiece_id": artpiece_id}, 200

@api.route("/remove_from_user/<string:artpiece_id>")
class RemoveFromUserCollection(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def delete(self, artpiece_id):
        identity = get_jwt_identity()

        result = mongo.db.users.update_one(
            {"email": identity},
            {"$pull": {"artpieces": artpiece_id}}
        )

        if result.modified_count == 0:
            return {"msg": "Art piece not in user collection"}, 404

        still_used = mongo.db.users.find_one({"artpieces": artpiece_id})
        if not still_used:
            mongo.db.artpieces.delete_one({"_id": ObjectId(artpiece_id)})

        log_user_action(identity, f"Removed art piece {artpiece_id} from collection")
        return {"msg": "Art piece removed"}, 200
