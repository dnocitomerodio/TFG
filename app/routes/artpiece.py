from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import mongo
from app.services.external_api import ExternalAPI
from app.models import ArtPiece

artpiece_bp = Blueprint("artpiece", __name__)
external_api = ExternalAPI("https://api.wikidata.org/sparql")

@artpiece_bp.route("/", methods=["GET"])
def get_art_pieces():
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

    return jsonify(results), 200

@artpiece_bp.route("/<artpiece_id>", methods=["GET"])
def get_artpiece(artpiece_id):
    artpiece = mongo.db.artpieces.find_one({"_id": artpiece_id})

    if not artpiece:
        return jsonify({"msg": "Art piece not found"}), 404

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

    return jsonify({"msg": "Art piece deleted successfully"}), 200
