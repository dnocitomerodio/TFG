from flask import request
from datetime import datetime
from app.extensions import mongo

def log_user_action(email, action):
    log = {
        "email": email,
        "action": action,
        "timestamp": datetime.utcnow().isoformat(),
        "ip": request.remote_addr,
        "user_agent": request.headers.get("User-Agent", "")
    }
    mongo.db.logs.insert_one(log)
