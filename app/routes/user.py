from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson import ObjectId
from app.extensions import mongo, bcrypt
from app.models import User
from app.services.logger_service import log_user_action

user_bp = Blueprint("user", __name__)

@user_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    identity = get_jwt_identity()
    user_data = mongo.db.users.find_one({"email": identity})

    if not user_data:
        return jsonify({"msg": "User not found"}), 404

    user = User(user_data)
    log_user_action(identity, "Viewed their profile")
    return jsonify(user.to_dict()), 200

@user_bp.route("/update", methods=["PUT"])
@jwt_required()
def update_profile():
    identity = get_jwt_identity()
    data = request.get_json()

    update_data = {}
    if "email" in data:
        update_data["email"] = data["email"]
    if "password" in data:
        update_data["password"] = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

    if update_data:
        mongo.db.users.update_one({"email": identity}, {"$set": update_data})
        log_user_action(identity, "Updated their profile")
        return jsonify({"msg": "Profile updated successfully"}), 200

    return jsonify({"msg": "No data to update"}), 400

@user_bp.route("/delete", methods=["DELETE"])
@jwt_required()
def delete_user():
    identity = get_jwt_identity()
    result = mongo.db.users.delete_one({"email": identity})

    if result.deleted_count == 0:
        return jsonify({"msg": "User not found"}), 404

    log_user_action(identity, "Deleted their account")
    return jsonify({"msg": "User deleted successfully"}), 200

@user_bp.route("/remove/<artpiece_id>", methods=["DELETE"])
@jwt_required()
def remove_artpiece_from_user(artpiece_id):
    identity = get_jwt_identity()
    user_email = identity

    result = mongo.db.users.update_one(
        {"email": user_email},
        {"$pull": {"artpieces": artpiece_id}}
    )

    if result.modified_count == 0:
        return jsonify({"msg": "Art piece not found in user list"}), 404

    users_with_artpiece = mongo.db.users.find_one({"artpieces": artpiece_id})

    if not users_with_artpiece:
        mongo.db.artpieces.delete_one({"_id": ObjectId(artpiece_id)})

    log_user_action(user_email, f"Removed art piece {artpiece_id} from their collection")
    return jsonify({"msg": "Art piece removed from user"}), 200

@user_bp.route("/users", methods=["GET"])
@jwt_required()
def get_all_users():
    claims = get_jwt()
    if claims["role"] != "admin":
        return jsonify({"msg": "Unauthorized"}), 403

    users = list(mongo.db.users.find({}, {"password": 0}))
    log_user_action(get_jwt_identity(), "Viewed all users")
    return jsonify(users), 200

@user_bp.route("/update_role/<user_id>", methods=["PUT"])
@jwt_required()
def update_user_role(user_id):
    claims = get_jwt()
    if claims["role"] != "admin":
        return jsonify({"msg": "Unauthorized"}), 403

    data = request.get_json()
    new_role = data.get("role")

    if not new_role:
        return jsonify({"msg": "New role is required"}), 400

    result = mongo.db.users.update_one(
        {"_id": ObjectId(user_id)}, {"$set": {"role": new_role}}
    )

    if result.matched_count == 0:
        return jsonify({"msg": "User not found"}), 404

    log_user_action(get_jwt_identity(), f"Updated user {user_id}'s role to {new_role}")
    return jsonify({"msg": f"User {user_id} role updated to {new_role}"}), 200
