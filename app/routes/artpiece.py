from flask import jsonify, request
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson import ObjectId
from app.extensions import mongo
from app.services.external_api import ExternalAPI
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
        limit = int(request.args.get("limit", 10))
        offset = int(request.args.get("offset", 0))
        expand = request.args.get("expand", "false").lower() == "true"

        if not query:
            return {"msg": "Query parameter is required"}, 400

        parsed_results = external_api.fetch_art_pieces(query, limit=limit, offset=offset, expand=expand)

        log_user_action(identity, f"Searched external API for art pieces: '{query}', expand={expand}")

        return parsed_results, 200

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

@api.route("/external/<string:external_id>")
class ExternalArtPieceDetail(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def get(self, external_id):
        identity = get_jwt_identity()
        data = request.get_json(silent=True) or {}
        user = mongo.db.users.find_one({"email": identity})
        default_user_level = user.get("level", "none")
        level = data.get("level", default_user_level)
        result = external_api.fetch_single_art_piece(external_id, level)
        if not result:
            return {"msg": "Art piece not found"}, 404

        log_user_action(identity, f"Viewed external art piece {external_id}")
        return result, 200

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

        if "external_id" not in data or not data["external_id"]:
            return {"msg": "Missing external_id"}, 400

        existing = mongo.db.artpieces.find_one({"external_id": data["external_id"]})

        if existing:
            artpiece_id = str(existing["_id"])
        else:
            artpiece_data = ArtPiece(data).to_dict()
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

@api.route("/artist")
class ArtistSearch(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth", params={"query": "Artist name to search for"})
    def get(self):
        identity = get_jwt_identity()
        artist_name = request.args.get("query", "")
        if not artist_name:
            return {"msg": "Query parameter is required (artist name)"}, 400

        artist_data = external_api.fetch_artist_data(artist_name)
        if not artist_data:
            return {"msg": f"Artist '{artist_name}' not found in Wikidata"}, 404

        artworks = external_api.fetch_works_by_artist(artist_data["wikidata_id"], limit=50)

        formatted_artworks = []
        for work in artworks:
            item = work.get("item", {}).get("value", "")
            external_id = item.split("/")[-1] if item else ""
            formatted_artworks.append({
                "external_id": external_id,
                "title": work.get("itemLabel", {}).get("value", ""),
                "description": work.get("itemDescription", {}).get("value", ""),
                "source_url": f"https://www.wikidata.org/wiki/{external_id}" if external_id else "",
                "sitelinks": int(work.get("sitelinks", {}).get("value", 0)) if "sitelinks" in work else 0
            })

        log_user_action(identity, f"Searched artworks for artist query: '{artist_name}'")

        return {
            "artist": artist_data,
            "artworks": formatted_artworks
        }, 200

@api.route("/nearby_museums")
class MuseumsNearby(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth", params={
        "lat": "Latitude (e.g., 43.2630)",
        "lon": "Longitude (e.g., -2.9350)",
        "radius_km": "Search radius in kilometers (e.g., 10)"
    })
    def get(self):
        identity = get_jwt_identity()
        lat = request.args.get("lat")
        lon = request.args.get("lon")
        radius_km = request.args.get("radius_km", "5")

        if not lat or not lon:
            return {"msg": "Latitude and longitude are required"}, 400

        try:
            results = external_api.fetch_museums_nearby(lat, lon, radius_km)
            log_user_action(identity, f"Fetched museums near coordinates ({lat}, {lon}) within {radius_km} km")
            return results, 200
        except Exception as e:
            return {"msg": f"Error retrieving museums: {str(e)}"}, 500


@api.route("/museum_works/<string:museum_id>")
class WorksByMuseum(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth", params={"museum_id": "Wikidata ID of the museum (e.g., Q160112)"})
    def get(self, museum_id):
        identity = get_jwt_identity()

        try:
            results = external_api.fetch_artworks_in_museum(museum_id)
            formatted = []
            for item in results:
                uri = item.get("item", {}).get("value", "")
                external_id = uri.split("/")[-1] if uri else ""
                formatted.append({
                    "external_id": external_id,
                    "title": item.get("itemLabel", {}).get("value", ""),
                    "author": item.get("creatorLabel", {}).get("value", ""),
                    "description": item.get("itemDescription", {}).get("value", ""),
                    "image": item.get("image", {}).get("value", ""),
                    "sitelinks": int(item.get("sitelinks", {}).get("value", 0)) if "sitelinks" in item else 0,
                    "source_url": f"https://www.wikidata.org/wiki/{external_id}"
                })

            log_user_action(identity, f"Fetched artworks for museum {museum_id}")
            return {"museum_id": museum_id, "artworks": formatted}, 200
        except Exception as e:
            return {"msg": f"Error retrieving museum artworks: {str(e)}"}, 500

@api.route("/recommendations")
class ArtPieceRecommendations(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth", params={
        "level": "Optional user level override (none, beginner, expert)",
        "offset": "Number of results to skip for pagination (default: 0)"
    })
    def get(self):
        identity = get_jwt_identity()
        user = mongo.db.users.find_one({"email": identity})
        if not user:
            return {"msg": "User not found"}, 404

        default_user_level = user.get("level", "none")
        level = request.args.get("level", default_user_level)
        if level not in ["none", "beginner", "expert"]:
            return {"msg": "Invalid level parameter. Use 'none', 'beginner', or 'expert'"}, 400

        try:
            offset = int(request.args.get("offset", 0))
            if offset < 0:
                return {"msg": "Offset must be non-negative"}, 400
        except ValueError:
            return {"msg": "Invalid offset parameter"}, 400

        external_ids = user.get("artpieces", [])

        try:
            raw_results = external_api.fetch_recommendations_from_wikidata(external_ids, level, offset)

            recommendations = []
            for result in raw_results:
                external_id = result.get("item", {}).get("value", "").split("/")[-1]
                title = result.get("itemLabel", {}).get("value", "")
                if not title or title == external_id:
                    title = f"Untitled ({external_id})"
                image = result.get("image", {}).get("value", "") or result.get("relatedImage", {}).get("value", "") or ""
                if image.startswith("commons:"):
                    image = f"http://commons.wikimedia.org/wiki/File:{image.replace('commons:', '')}"
                if image and not image.startswith(("http://commons.wikimedia.org/", "https://commons.wikimedia.org/")):
                    image = ""
                recommendations.append({
                    "_id": external_id,
                    "title": title,
                    "author": result.get("creatorLabel", {}).get("value", "") or "Unknown artist",
                    "description": result.get("description", {}).get("value", "") or "No description available",
                    "image": image,
                    "museum": result.get("museumLabel", {}).get("value", "") or "Unknown museum",
                    "style": result.get("styleLabel", {}).get("value", "") or "Unknown style",
                    "sitelinks": int(result.get("sitelinks", {}).get("value", 0)) if result.get("sitelinks") else 0
                })

            if level == "beginner":
                recommendations = [r for r in recommendations if r.get("sitelinks", 0) > 5]
            elif level == "expert":
                recommendations = [r for r in recommendations if r.get("sitelinks", 0) <= 5 and r.get("sitelinks", 0) > 0]

            seen = set()
            unique_recommendations = []
            for rec in recommendations:
                if rec["_id"] not in seen:
                    seen.add(rec["_id"])
                    unique_recommendations.append(rec)

            page_size = 10
            start = offset
            end = start + page_size
            paginated_recommendations = unique_recommendations[start:end]

            formatted = [
                {
                    "external_id": rec.get("_id", ""),
                    "title": rec.get("title", "") or f"Untitled ({rec.get('_id', '')})",
                    "author": rec.get("author", "") or "Unknown artist",
                    "description": rec.get("description", "") or "No description available",
                    "image": rec.get("image", "") or "",
                    "museum": rec.get("museum", "") or "Unknown museum",
                    "style": rec.get("style", "") or "Unknown style",
                    "source_url": f"https://www.wikidata.org/wiki/{rec.get('_id', '')}" if rec.get('_id') else ""
                }
                for rec in paginated_recommendations
                if rec.get("_id")
            ]

            log_user_action(identity, f"Fetched recommendations with level={level}, external_ids={external_ids}, offset={offset}")
            return formatted, 200
        except Exception as e:
            return {"msg": f"Error retrieving recommendations: {str(e)}"}, 500