from flask import request
from datetime import datetime
import logging
from app.extensions import mongo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def log_user_action(email, action):
    try:
        ip_address = request.remote_addr if hasattr(request, 'remote_addr') else "N/A"
        log = {
            "email": email,
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
            "ip": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", "")
        }
        mongo.db.logs.insert_one(log)
        logger.info("Logged action for %s: %s (IP: %s)", email, action, ip_address)
    except Exception as e:
        logger.error("Error logging action for %s: %s", email, str(e))
