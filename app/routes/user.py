from flask import request
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson import ObjectId
from app.extensions import mongo, bcrypt
from app.models import User
from app.services.logger_service import log_user_action

api = Namespace("user", description="User-related operations, including managing profiles, roles, and users.")


def is_admin():
    claims = get_jwt()
    return claims.get("role") == "admin"


user_model = api.model("User", {
    "email": fields.String(required=True, description="The user's email address."),
    "password": fields.String(required=True, description="The user's password."),
    "role": fields.String(required=False, description="The user's role."),
})


@api.route("/profile")
class UserProfile(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def get(self):
        identity = get_jwt_identity()
        user_data = mongo.db.users.find_one({"email": identity})

        if not user_data:
            return {"msg": "User not found"}, 404

        user = User(user_data)
        log_user_action(identity, "Viewed their profile")
        return user.to_dict(), 200


@api.route("/update")
class UpdateProfile(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def put(self):
        identity = get_jwt_identity()
        user_data = mongo.db.users.find_one({"email": identity})

        if not user_data:
            return {"msg": "User not found"}, 404

        data = request.get_json()
        update_data = {}

        if "email" in data and data["email"] != identity:
            return {"msg": "Email change is not allowed"}, 403

        if "password" in data:
            update_data["password"] = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

        if update_data:
            mongo.db.users.update_one({"email": identity}, {"$set": update_data})
            log_user_action(identity, "Updated their profile")
            return {"msg": "Profile updated successfully"}, 200

        return {"msg": "No data to update"}, 400


@api.route("/delete")
class DeleteUser(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def delete(self):
        identity = get_jwt_identity()
        result = mongo.db.users.delete_one({"email": identity})

        if result.deleted_count == 0:
            return {"msg": "User not found"}, 404

        log_user_action(identity, "Deleted their account")
        return {"msg": "User deleted successfully"}, 200


@api.route("/remove/<string:artpiece_id>")
class RemoveArtpiece(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def delete(self, artpiece_id):
        identity = get_jwt_identity()

        result = mongo.db.users.update_one(
            {"email": identity},
            {"$pull": {"artpieces": artpiece_id}}
        )

        if result.modified_count == 0:
            return {"msg": "Art piece not found in user list"}, 404

        users_with_artpiece = mongo.db.users.find_one({"artpieces": artpiece_id})
        if not users_with_artpiece:
            mongo.db.artpieces.delete_one({"_id": ObjectId(artpiece_id)})

        log_user_action(identity, f"Removed art piece {artpiece_id} from their collection")
        return {"msg": "Art piece removed from user"}, 200


@api.route("/users")
class AllUsers(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def get(self):
        if not is_admin():
            return {"msg": "Unauthorized"}, 403

        users = list(mongo.db.users.find({}, {"password": 0}))
        log_user_action(get_jwt_identity(), "Viewed all users")
        return users, 200


@api.route("/update_role/<string:user_id>")
class UpdateUserRole(Resource):
    @jwt_required()
    @api.expect(user_model)
    @api.doc(security="Bearer Auth")
    def put(self, user_id):
        if not is_admin():
            return {"msg": "Unauthorized"}, 403

        data = request.get_json()
        new_role = data.get("role")

        if not new_role:
            return {"msg": "New role is required"}, 400

        result = mongo.db.users.update_one(
            {"_id": ObjectId(user_id)}, {"$set": {"role": new_role}}
        )

        if result.matched_count == 0:
            return {"msg": "User not found"}, 404

        log_user_action(get_jwt_identity(), f"Updated user {user_id}'s role to {new_role}")
        return {"msg": f"User {user_id} role updated to {new_role}"}, 200
