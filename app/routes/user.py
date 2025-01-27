from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mongo
from app.models import ArtPiece

user_bp = Blueprint("user", __name__)

@user_bp.route("/me", methods=["GET"])
@jwt_required()
def get_user():
    current_user = get_jwt_identity()
    user = mongo.db.users.find_one({"email": current_user["email"]}, {"_id": 0, "password": 0})
    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify(user), 200

@user_bp.route("/favorites", methods=["GET"])
@jwt_required()
def get_favorites():
    current_user = get_jwt_identity()
    user = mongo.db.users.find_one({"email": current_user["email"]})
    if not user:
        return jsonify({"msg": "User not found"}), 404

    favorites = mongo.db.artpieces.find({"_id": {"$in": user.get("favorites", [])}})
    return jsonify([ArtPiece(f).to_dict() for f in favorites]), 200

@user_bp.route("/favorites", methods=["POST"])
@jwt_required()
def add_favorite():
    current_user = get_jwt_identity()
    data = request.get_json()
    user = mongo.db.users.find_one({"email": current_user["email"]})

    if not user:
        return jsonify({"msg": "User not found"}), 404

    mongo.db.users.update_one(
        {"email": current_user["email"]},
        {"$addToSet": {"favorites": data["artpiece_id"]}}
    )
    return jsonify({"msg": "Artpiece added to favorites"}), 200
