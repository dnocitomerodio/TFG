from flask import jsonify, request
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import get_jwt, jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime
import logging
from app.extensions import mongo
from app.models import Thread, Reply, User
from app.services.logger_service import log_user_action

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

api = Namespace("community", description="Manage community threads and replies")

def is_admin():
    return get_jwt().get("role") == "admin"

def convert_objectid_to_str(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: convert_objectid_to_str(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_objectid_to_str(item) for item in obj]
    return obj

thread_model = api.model("Thread", {
    "title": fields.String(required=True, description="Title of the thread", max_length=100),
    "content": fields.String(required=True, description="Content of the thread"),
})

reply_model = api.model("Reply", {
    "content": fields.String(required=True, description="Content of the reply"),
})

@api.route("/")
class ThreadList(Resource):
    @jwt_required(optional=True)
    @api.doc(security="Bearer Auth")
    def get(self):
        identity = get_jwt_identity()
        if not identity:
            return {"msg": "Missing or invalid token"}, 401
        try:
            threads = mongo.db.forums.find().sort("created_at", -1)
            thread_list = [convert_objectid_to_str(Thread(thread).to_dict()) for thread in threads]
            log_user_action(identity, "Fetched all community threads")
            return thread_list, 200
        except Exception as e:
            logger.error("Error fetching threads for user %s: %s", identity, str(e))
            return {"msg": f"Error fetching threads: {str(e)}"}, 500

    @jwt_required()
    @api.expect(thread_model)
    @api.doc(security="Bearer Auth")
    def post(self):
        identity = get_jwt_identity()
        data = request.get_json()
        try:
            user = mongo.db.users.find_one({"email": identity})
            if not user:
                logger.info("User %s not found for creating thread", identity)
                return {"msg": "User not found"}, 404
            thread_data = {
                "title": data.get("title", "").strip(),
                "content": data.get("content", "").strip(),
                "author_id": user["_id"],
                "author_email": user["email"],
                "created_at": datetime.utcnow(),
                "replies": [],
                "reported": False
            }
            if not thread_data["title"] or not thread_data["content"]:
                logger.info("User %s attempted to create thread without title or content", identity)
                return {"msg": "Title and content are required"}, 400
            if len(thread_data["title"]) > 100:
                logger.info("User %s attempted to create thread with title exceeding 100 characters", identity)
                return {"msg": "Title cannot exceed 100 characters"}, 400
            result = mongo.db.forums.insert_one(thread_data)
            thread_data["_id"] = str(result.inserted_id)
            logger.info("User %s created thread %s: %s", identity, thread_data["_id"], thread_data["title"])
            log_user_action(identity, f"Created thread {thread_data['_id']}")
            return convert_objectid_to_str(Thread(thread_data).to_dict()), 201
        except Exception as e:
            logger.error("Error creating thread for user %s: %s", identity, str(e))
            return {"msg": f"Error creating thread: {str(e)}"}, 500

@api.route("/<string:thread_id>")
class ThreadDetail(Resource):
    @jwt_required(optional=True)
    @api.doc(security="Bearer Auth")
    def get(self, thread_id):
        identity = get_jwt_identity()
        if not identity:
            return {"msg": "Missing or invalid token"}, 401
        try:
            thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            if not thread:
                logger.info("Thread %s not found for user %s", thread_id, identity)
                return {"msg": "Thread not found"}, 404
            log_user_action(identity, f"Viewed thread {thread_id}")
            return convert_objectid_to_str(Thread(thread).to_dict()), 200
        except Exception as e:
            logger.error("Error fetching thread %s for user %s: %s", thread_id, identity, str(e))
            return {"msg": f"Error fetching thread: {str(e)}"}, 500

    @jwt_required()
    @api.doc(security="Bearer Auth")
    def delete(self, thread_id):
        identity = get_jwt_identity()
        if not is_admin():
            logger.info("User %s attempted to delete thread %s without admin privileges", identity, thread_id)
            return {"msg": "Unauthorized"}, 403
        try:
            result = mongo.db.forums.delete_one({"_id": ObjectId(thread_id)})
            if result.deleted_count == 0:
                logger.info("Thread %s not found for deletion by user %s", thread_id, identity)
                return {"msg": "Thread not found"}, 404
            logger.info("User %s deleted thread %s", identity, thread_id)
            log_user_action(identity, f"Deleted thread {thread_id}")
            return {"msg": "Thread deleted"}, 200
        except Exception as e:
            logger.error("Error deleting thread %s for user %s: %s", thread_id, identity, str(e))
            return {"msg": f"Error deleting thread: {str(e)}"}, 500

@api.route("/<string:thread_id>/replies")
class ThreadReplies(Resource):
    @jwt_required()
    @api.expect(reply_model)
    @api.doc(security="Bearer Auth")
    def post(self, thread_id):
        identity = get_jwt_identity()
        data = request.get_json()
        try:
            user = mongo.db.users.find_one({"email": identity})
            if not user:
                logger.info("User %s not found for replying to thread %s", identity, thread_id)
                return {"msg": "User not found"}, 404
            thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            if not thread:
                logger.info("Thread %s not found for reply by user %s", thread_id, identity)
                return {"msg": "Thread not found"}, 404
            reply_data = {
                "content": data.get("content", "").strip(),
                "author_id": user["_id"],
                "author_email": user["email"],
                "created_at": datetime.utcnow(),
                "reported": False
            }
            if not reply_data["content"]:
                logger.info("User %s attempted to post empty reply to thread %s", identity, thread_id)
                return {"msg": "Content is required"}, 400
            mongo.db.forums.update_one(
                {"_id": ObjectId(thread_id)},
                {"$push": {"replies": reply_data}}
            )
            updated_thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            logger.info("User %s added reply to thread %s", identity, thread_id)
            log_user_action(identity, f"Added reply to thread {thread_id}")
            return convert_objectid_to_str(Thread(updated_thread).to_dict()), 201
        except Exception as e:
            logger.error("Error adding reply to thread %s for user %s: %s", thread_id, identity, str(e))
            return {"msg": f"Error adding reply: {str(e)}"}, 500