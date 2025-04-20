from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson import ObjectId
from app.extensions import mongo
from app.services.external_api import ExternalAPI
from app.models import ArtPiece
from app.services.logger_service import log_user_action

artpiece_bp = Blueprint("artpiece", __name__)
external_api = ExternalAPI("https://api.wikidata.org/sparql")

def is_admin():
    return get_jwt().get("role") == "admin"

@artpiece_bp.route("/", methods=["GET"])
@jwt_required()
def get_art_pieces():
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

    return jsonify(results), 200

@artpiece_bp.route("/<artpiece_id>", methods=["GET"])
@jwt_required()
def get_artpiece(artpiece_id):
    identity = get_jwt_identity()
    artpiece = mongo.db.artpieces.find_one({"_id": ObjectId(artpiece_id)})
    if not artpiece:
        return jsonify({"msg": "Art piece not found"}), 404

    log_user_action(identity, f"Viewed art piece {artpiece_id}")
    return jsonify(artpiece), 200

@artpiece_bp.route("/add_to_user", methods=["POST"])
@jwt_required()
def add_artpiece_to_user():
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
    return jsonify({"msg": "Art piece added to user", "artpiece_id": artpiece_id}), 200

@artpiece_bp.route("/remove_from_user/<artpiece_id>", methods=["DELETE"])
@jwt_required()
def remove_artpiece_from_user(artpiece_id):
    identity = get_jwt_identity()

    result = mongo.db.users.update_one(
        {"email": identity},
        {"$pull": {"artpieces": artpiece_id}}
    )

    if result.modified_count == 0:
        return jsonify({"msg": "Art piece not found in user list"}), 404

    still_used = mongo.db.users.find_one({"artpieces": artpiece_id})
    if not still_used:
        mongo.db.artpieces.delete_one({"_id": ObjectId(artpiece_id)})

    log_user_action(identity, f"Removed art piece {artpiece_id} from their collection")
    return jsonify({"msg": "Art piece removed from user"}), 200

@artpiece_bp.route("/", methods=["POST"])
@jwt_required()
def add_artpiece():
    identity = get_jwt_identity()
    if not is_admin():
        return jsonify({"msg": "Unauthorized"}), 403

    data = request.get_json()
    artpiece = ArtPiece(data).to_dict()
    mongo.db.artpieces.insert_one(artpiece)
    log_user_action(identity, "Added a new art piece")
    return jsonify({"msg": "Art piece added successfully"}), 201

@artpiece_bp.route("/<artpiece_id>", methods=["PUT"])
@jwt_required()
def update_artpiece(artpiece_id):
    identity = get_jwt_identity()
    if not is_admin():
        return jsonify({"msg": "Unauthorized"}), 403

    data = request.get_json()
    update_result = mongo.db.artpieces.update_one(
        {"_id": ObjectId(artpiece_id)},
        {"$set": data}
    )

    if update_result.matched_count == 0:
        return jsonify({"msg": "Art piece not found"}), 404

    log_user_action(identity, f"Updated art piece {artpiece_id}")
    return jsonify({"msg": "Art piece updated successfully"}), 200

@artpiece_bp.route("/<artpiece_id>", methods=["DELETE"])
@jwt_required()
def delete_artpiece(artpiece_id):
    identity = get_jwt_identity()
    if not is_admin():
        return jsonify({"msg": "Unauthorized"}), 403

    delete_result = mongo.db.artpieces.delete_one({"_id": ObjectId(artpiece_id)})
    if delete_result.deleted_count == 0:
        return jsonify({"msg": "Art piece not found"}), 404

    log_user_action(identity, f"Deleted art piece {artpiece_id}")
    return jsonify({"msg": "Art piece deleted successfully"}), 200
