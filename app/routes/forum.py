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

vote_model = api.model("Vote", {
    "vote_type": fields.String(required=True, description="Vote type (like or dislike)", enum=["like", "dislike"]),
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
            page = int(request.args.get("page", 1))
            per_page = int(request.args.get("per_page", 10))
            skip = (page - 1) * per_page
            threads = mongo.db.forums.find().sort("created_at", -1).skip(skip).limit(per_page)
            total_threads = mongo.db.forums.count_documents({})
            thread_list = [convert_objectid_to_str(Thread(thread).to_dict()) for thread in threads]
            log_user_action(identity, f"Fetched community threads (page {page}, {per_page} per page)")
            return {
                "threads": thread_list,
                "total": total_threads,
                "page": page,
                "per_page": per_page
            }, 200
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
                "reported": False,
                "likes": 0,
                "dislikes": 0,
                "voters": []
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

@api.route("/search")
class ThreadSearch(Resource):
    @jwt_required(optional=True)
    @api.doc(security="Bearer Auth")
    def get(self):
        identity = get_jwt_identity()
        if not identity:
            return {"msg": "Missing or invalid token"}, 401
        try:
            query = request.args.get("q", "")
            page = int(request.args.get("page", 1))
            per_page = int(request.args.get("per_page", 10))
            skip = (page - 1) * per_page
            search_filter = {
                "$or": [
                    {"title": {"$regex": query, "$options": "i"}},
                    {"content": {"$regex": query, "$options": "i"}}
                ]
            }
            threads = mongo.db.forums.find(search_filter).sort("created_at", -1).skip(skip).limit(per_page)
            total_threads = mongo.db.forums.count_documents(search_filter)
            thread_list = [convert_objectid_to_str(Thread(thread).to_dict()) for thread in threads]
            log_user_action(identity, f"Searched threads with query '{query}' (page {page}, {per_page} per page)")
            return {
                "threads": thread_list,
                "total": total_threads,
                "page": page,
                "per_page": per_page
            }, 200
        except Exception as e:
            logger.error("Error searching threads for user %s: %s", identity, str(e))
            return {"msg": f"Error searching threads: {str(e)}"}, 500

@api.route("/<string:thread_id>")
class ThreadDetail(Resource):
    @jwt_required(optional=True)
    @api.doc(security="Bearer Auth")
    def get(self, thread_id):
        identity = get_jwt_identity()
        if not identity:
            return {"msg": "Missing or invalid token"}, 401
        try:
            sort = request.args.get("sort", "date")
            thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            if not thread:
                logger.info("Thread %s not found for user %s", thread_id, identity)
                return {"msg": "Thread not found"}, 404
            thread_dict = Thread(thread).to_dict()
            if sort == "popularity":
                thread_dict["replies"] = sorted(
                    thread_dict["replies"],
                    key=lambda r: (r.get("likes", 0) - r.get("dislikes", 0)),
                    reverse=True
                )
            log_user_action(identity, f"Viewed thread {thread_id}")
            return convert_objectid_to_str(thread_dict), 200
        except Exception as e:
            logger.error("Error fetching thread %s for user %s: %s", thread_id, identity, str(e))
            return {"msg": f"Error fetching thread: {str(e)}"}, 500

    @jwt_required()
    @api.doc(security="Bearer Auth")
    def delete(self, thread_id):
        identity = get_jwt_identity()
        try:
            user = mongo.db.users.find_one({"email": identity})
            if not user:
                logger.info("User %s not found for deleting thread %s", identity, thread_id)
                return {"msg": "User not found"}, 404
            thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            if not thread:
                logger.info("Thread %s not found for deletion by user %s", thread_id, identity)
                return {"msg": "Thread not found"}, 404
            if not (is_admin() or thread["author_id"] == user["_id"]):
                logger.info("User %s attempted to delete thread %s without permission", identity, thread_id)
                return {"msg": "Unauthorized"}, 403
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

@api.route("/<string:thread_id>/vote")
class ThreadVote(Resource):
    @jwt_required()
    @api.expect(vote_model)
    @api.doc(security="Bearer Auth")
    def post(self, thread_id):
        identity = get_jwt_identity()
        data = request.get_json()
        vote_type = data.get("vote_type")
        if vote_type not in ["like", "dislike"]:
            return {"msg": "Invalid vote type"}, 400
        try:
            user = mongo.db.users.find_one({"email": identity})
            if not user:
                logger.info("User %s not found for voting on thread %s", identity, thread_id)
                return {"msg": "User not found"}, 404
            thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            if not thread:
                logger.info("Thread %s not found for voting by user %s", thread_id, identity)
                return {"msg": "Thread not found"}, 404
            voters = thread.get("voters", [])
            user_vote = next((v for v in voters if v["user_id"] == str(user["_id"])), None)
            update = {}
            if user_vote:
                if user_vote["vote_type"] == vote_type:
                    return {"msg": f"User already {vote_type}d this thread"}, 400
                reverse_field = "dislikes" if user_vote["vote_type"] == "like" else "likes"
                update[f"$inc"] = {reverse_field: -1}
                update["$pull"] = {"voters": {"user_id": str(user["_id"])}}
            update["$inc"] = update.get("$inc", {})
            update["$inc"][f"{vote_type}s"] = 1
            update["$push"] = {"voters": {"user_id": str(user["_id"]), "vote_type": vote_type}}
            mongo.db.forums.update_one({"_id": ObjectId(thread_id)}, update)
            updated_thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            logger.info("User %s %sd thread %s", identity, vote_type, thread_id)
            log_user_action(identity, f"{vote_type.capitalize()}d thread {thread_id}")
            return convert_objectid_to_str(Thread(updated_thread).to_dict()), 200
        except Exception as e:
            logger.error("Error voting on thread %s for user %s: %s", thread_id, identity, str(e))
            return {"msg": f"Error voting on thread: {str(e)}"}, 500

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
                "reported": False,
                "likes": 0,
                "dislikes": 0,
                "voters": []
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

@api.route("/<string:thread_id>/replies/<int:reply_index>")
class ReplyDetail(Resource):
    @jwt_required()
    @api.doc(security="Bearer Auth")
    def delete(self, thread_id, reply_index):
        identity = get_jwt_identity()
        try:
            user = mongo.db.users.find_one({"email": identity})
            if not user:
                logger.info("User %s not found for deleting reply %s in thread %s", identity, reply_index, thread_id)
                return {"msg": "User not found"}, 404
            thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            if not thread:
                logger.info("Thread %s not found for deleting reply %s by user %s", thread_id, reply_index, identity)
                return {"msg": "Thread not found"}, 404
            if reply_index >= len(thread["replies"]):
                logger.info("Reply %s not found in thread %s for user %s", reply_index, thread_id, identity)
                return {"msg": "Reply not found"}, 404
            reply = thread["replies"][reply_index]
            if not (is_admin() or reply["author_id"] == user["_id"]):
                logger.info("User %s attempted to delete reply %s in thread %s without permission", identity, reply_index, thread_id)
                return {"msg": "Unauthorized"}, 403
            mongo.db.forums.update_one(
                {"_id": ObjectId(thread_id)},
                {"$pull": {"replies": thread["replies"][reply_index]}}
            )
            logger.info("User %s deleted reply %s in thread %s", identity, reply_index, thread_id)
            log_user_action(identity, f"Deleted reply {reply_index} in thread {thread_id}")
            return {"msg": "Reply deleted"}, 200
        except Exception as e:
            logger.error("Error deleting reply %s in thread %s for user %s: %s", reply_index, thread_id, identity, str(e))
            return {"msg": f"Error deleting reply: {str(e)}"}, 500

@api.route("/<string:thread_id>/replies/<int:reply_index>/vote")
class ReplyVote(Resource):
    @jwt_required()
    @api.expect(vote_model)
    @api.doc(security="Bearer Auth")
    def post(self, thread_id, reply_index):
        identity = get_jwt_identity()
        data = request.get_json()
        vote_type = data.get("vote_type")
        if vote_type not in ["like", "dislike"]:
            return {"msg": "Invalid vote type"}, 400
        try:
            user = mongo.db.users.find_one({"email": identity})
            if not user:
                logger.info("User %s not found for voting on reply %s in thread %s", identity, reply_index, thread_id)
                return {"msg": "User not found"}, 404
            thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            if not thread:
                logger.info("Thread %s not found for voting on reply %s by user %s", thread_id, reply_index, identity)
                return {"msg": "Thread not found"}, 404
            if reply_index >= len(thread["replies"]):
                logger.info("Reply %s not found in thread %s for user %s", reply_index, thread_id, identity)
                return {"msg": "Reply not found"}, 404
            reply = thread["replies"][reply_index]
            voters = reply.get("voters", [])
            user_vote = next((v for v in voters if v["user_id"] == str(user["_id"])), None)
            update = {}
            if user_vote:
                if user_vote["vote_type"] == vote_type:
                    return {"msg": f"User already {vote_type}d this reply"}, 400
                reverse_field = "dislikes" if user_vote["vote_type"] == "like" else "likes"
                update[f"$inc"] = {f"replies.{reply_index}.{reverse_field}": -1}
                update["$pull"] = {f"replies.{reply_index}.voters": {"user_id": str(user["_id"])}}
            update["$inc"] = update.get("$inc", {})
            update["$inc"][f"replies.{reply_index}.{vote_type}s"] = 1
            update["$push"] = {f"replies.{reply_index}.voters": {"user_id": str(user["_id"]), "vote_type": vote_type}}
            mongo.db.forums.update_one({"_id": ObjectId(thread_id)}, update)
            updated_thread = mongo.db.forums.find_one({"_id": ObjectId(thread_id)})
            logger.info("User %s %sd reply %s in thread %s", identity, vote_type, reply_index, thread_id)
            log_user_action(identity, f"{vote_type.capitalize()}d reply {reply_index} in thread {thread_id}")
            return convert_objectid_to_str(Thread(updated_thread).to_dict()), 200
        except Exception as e:
            logger.error("Error voting on reply %s in thread %s for user %s: %s", reply_index, thread_id, identity, str(e))
            return {"msg": f"Error voting on reply: {str(e)}"}, 500