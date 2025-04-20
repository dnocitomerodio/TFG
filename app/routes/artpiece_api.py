from flask import request, jsonify
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson import ObjectId
from app.extensions import mongo
from app.services.external_api import ExternalAPI
from app.models import ArtPiece
from app.services.logger_service import log_user_action

api = Namespace("artpiece", description="Operations for managing art pieces, including viewing, adding, updating, and removing artworks.")

external_api = ExternalAPI("https://api.wikidata.org/sparql")

def is_admin():
    """Helper function to check if the current user has admin privileges"""
    return get_jwt().get("role") == "admin"

artpiece_model = api.model("ArtPiece", {
    "title": fields.String(required=True, description="The title of the art piece. This field is required."),
    "author": fields.String(required=True, description="The author or creator of the art piece. This field is required."),
    "year": fields.Integer(description="The year the art piece was created."),
    "style": fields.String(description="The artistic style the art piece belongs to."),
    "museum": fields.String(description="The museum where the art piece is located."),
    "location": fields.String(description="Location details of the art piece."),
    "medium": fields.String(description="The medium used to create the art piece (e.g., painting, sculpture)."),
    "dimensions": fields.String(description="The dimensions of the art piece."),
    "image": fields.String(description="URL of an image representing the art piece."),
    "description": fields.String(description="Detailed description of the art piece."),
    "tags": fields.List(fields.String, description="Tags associated with the art piece."),
    "external_id": fields.String(description="External ID for the art piece, if available."),
    "source_url": fields.String(description="URL of the original source from where the art piece information was obtained.")
})

@api.route("/")
class ArtPieceList(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth", description="Accessible by any authenticated user to view art pieces.")
    def get(self):
        """Retrieve a list of art pieces, with optional filtering and pagination"""
        identity = get_jwt_identity()
        query = request.args.get("query", "")
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
        skip = (page - 1) * limit

        results = list(mongo.db.artpieces.find().skip(skip).limit(limit))

        if not results and query:
            external_results = external_api.fetch_art_pieces(query, limit=limit)
            for result in external_results:
                artpiece = ArtPiece(result).to_dict()
                mongo.db.artpieces.insert_one(artpiece)
                results.append(artpiece)
            log_user_action(identity, f"Searched external API for art pieces with query: '{query}'")
        else:
            log_user_action(identity, f"Viewed art pieces list (query='{query}', page={page}, limit={limit})")

        return results, 200

    @jwt_required()
    @api.expect(artpiece_model)
    @api.doc(security="Bearer Auth", description="Only accessible by admins to add new art pieces.")
    def post(self):
        """Add a new art piece to the collection (admin only)"""
        identity = get_jwt_identity()
        if not is_admin():
            return {"msg": "Unauthorized"}, 403

        data = request.get_json()
        artpiece = ArtPiece(data).to_dict()

        mongo.db.artpieces.insert_one(artpiece)
        log_user_action(identity, "Added a new art piece")
        return {"msg": "Art piece added successfully"}, 201

@api.route("/<string:artpiece_id>")
class ArtPieceById(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth", description="Accessible by any authenticated user to view a specific art piece.")
    def get(self, artpiece_id):
        """Retrieve a specific art piece by its ID"""
        identity = get_jwt_identity()
        artpiece = mongo.db.artpieces.find_one({"_id": ObjectId(artpiece_id)})
        if not artpiece:
            return {"msg": "Art piece not found"}, 404

        log_user_action(identity, f"Viewed art piece {artpiece_id}")
        return artpiece, 200

    @jwt_required()
    @api.doc(security="Bearer Auth", description="Only accessible by admins to update an art piece.")
    def put(self, artpiece_id):
        """Update the details of a specific art piece (admin only)"""
        identity = get_jwt_identity()
        if not is_admin():
            return {"msg": "Unauthorized"}, 403

        data = request.get_json()
        update_result = mongo.db.artpieces.update_one(
            {"_id": ObjectId(artpiece_id)},
            {"$set": data}
        )

        if update_result.matched_count == 0:
            return {"msg": "Art piece not found"}, 404

        log_user_action(identity, f"Updated art piece {artpiece_id}")
        return {"msg": "Art piece updated successfully"}, 200

    @jwt_required()
    @api.doc(security="Bearer Auth", description="Only accessible by admins to delete an art piece.")
    def delete(self, artpiece_id):
        """Delete a specific art piece by its ID (admin only)"""
        identity = get_jwt_identity()
        if not is_admin():
            return {"msg": "Unauthorized"}, 403

        delete_result = mongo.db.artpieces.delete_one({"_id": ObjectId(artpiece_id)})
        if delete_result.deleted_count == 0:
            return {"msg": "Art piece not found"}, 404

        log_user_action(identity, f"Deleted art piece {artpiece_id}")
        return {"msg": "Art piece deleted successfully"}, 200

@api.route("/add_to_user")
class AddArtPieceToUser(Resource):
    @jwt_required()
    @api.expect(artpiece_model)
    @api.doc(security="Bearer Auth", description="Accessible by any authenticated user to add an art piece to their collection.")
    def post(self):
        """Add an art piece to the authenticated user's collection"""
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

        log_user_action(identity, f"Added art piece {artpiece_id} to their collection")
        return {"msg": "Art piece added to user", "artpiece_id": artpiece_id}, 200

@api.route("/remove_from_user/<string:artpiece_id>")
class RemoveArtPieceFromUser(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth", description="Accessible by any authenticated user to remove an art piece from their collection.")
    def delete(self, artpiece_id):
        """Remove a specific art piece from the authenticated user's collection"""
        identity = get_jwt_identity()

        result = mongo.db.users.update_one(
            {"email": identity},
            {"$pull": {"artpieces": artpiece_id}}
        )

        if result.modified_count == 0:
            return {"msg": "Art piece not found in user list"}, 404

        still_used = mongo.db.users.find_one({"artpieces": artpiece_id})
        if not still_used:
            mongo.db.artpieces.delete_one({"_id": ObjectId(artpiece_id)})

        log_user_action(identity, f"Removed art piece {artpiece_id} from their collection")
        return {"msg": "Art piece removed from user"}, 200
