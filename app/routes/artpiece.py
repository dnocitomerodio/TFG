from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import mongo
from app.services.external_api import ExternalAPI
from app.models import ArtPiece
from app.services.logger_service import log_user_action

artpiece_bp = Blueprint("artpiece", __name__)
external_api = ExternalAPI("https://api.wikidata.org/sparql")

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
    artpiece = mongo.db.artpieces.find_one({"_id": artpiece_id})

    if not artpiece:
        return jsonify({"msg": "Art piece not found"}), 404

    log_user_action(identity, f"Viewed art piece {artpiece_id}")
    return jsonify(artpiece), 200

@artpiece_bp.route("/", methods=["POST"])
@jwt_required()
def add_artpiece():
    identity = get_jwt_identity()

    if identity["role"] != "admin":
        return jsonify({"msg": "Unauthorized"}), 403

    data = request.get_json()
    artpiece = ArtPiece(data).to_dict()

    mongo.db.artpieces.insert_one(artpiece)
    log_user_action(identity["email"], "Added a new art piece")
    return jsonify({"msg": "Art piece added successfully"}), 201

@artpiece_bp.route("/<artpiece_id>", methods=["PUT"])
@jwt_required()
def update_artpiece(artpiece_id):
    identity = get_jwt_identity()

    if identity["role"] != "admin":
        return jsonify({"msg": "Unauthorized"}), 403

    data = request.get_json()
    update_result = mongo.db.artpieces.update_one({"_id": artpiece_id}, {"$set": data})

    if update_result.matched_count == 0:
        return jsonify({"msg": "Art piece not found"}), 404

    log_user_action(identity["email"], f"Updated art piece {artpiece_id}")
    return jsonify({"msg": "Art piece updated successfully"}), 200

@artpiece_bp.route("/<artpiece_id>", methods=["DELETE"])
@jwt_required()
def delete_artpiece(artpiece_id):
    identity = get_jwt_identity()

    if identity["role"] != "admin":
        return jsonify({"msg": "Unauthorized"}), 403

    delete_result = mongo.db.artpieces.delete_one({"_id": artpiece_id})

    if delete_result.deleted_count == 0:
        return jsonify({"msg": "Art piece not found"}), 404

    log_user_action(identity["email"], f"Deleted art piece {artpiece_id}")
    return jsonify({"msg": "Art piece deleted successfully"}), 200
