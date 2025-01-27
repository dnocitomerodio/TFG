from flask import Blueprint, request, jsonify
from app import mongo
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
