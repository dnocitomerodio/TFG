import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
import os
import logging
from app.extensions import mongo
from app.services.external_api import ExternalAPI
from app.services.logger_service import log_user_action

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

external_api = ExternalAPI("https://query.wikidata.org/sparql")

def send_notification_email(email, nearby_artworks):
    if not nearby_artworks:
        return

    msg = EmailMessage()
    msg["Subject"] = "Musaica: Nearby Artworks Found!"
    msg["From"] = SMTP_EMAIL
    msg["To"] = email

    content = "Hello,\n\nThe following artworks from your collection are nearby:\n\n"
    for artwork in nearby_artworks:
        content += f"- {artwork['title']} by {artwork['author']} (at {artwork['museum']})\n"
    content += "\nView them in the Musaica app: http://localhost:3000/collection\n\nBest,\nThe Musaica Team"

    msg.set_content(content)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        log_user_action(email, f"Sent notification email with {len(nearby_artworks)} artworks")
    except Exception as e:
        logger.error("Failed to send notification email to %s: %s", email, str(e))
        log_user_action(email, f"Failed to send notification email: {str(e)}")

def check_nearby_artworks():
    try:
        users = mongo.db.users.find({
            "notifications_enabled": True,
            "last_location.lat": {"$exists": True},
            "last_location.lon": {"$exists": True}
        })

        for user in users:
            email = user.get("email")
            external_ids = user.get("artpieces", [])
            if not external_ids:
                continue

            frequency_minutes = user.get("notification_frequency", 1440)
            last_notified = user.get("last_notified_artworks", [])
            if last_notified:
                latest_notification = max(
                    last_notified,
                    key=lambda x: datetime.fromisoformat(x["timestamp"]),
                    default=None
                )
                if latest_notification:
                    last_notification_time = datetime.fromisoformat(latest_notification["timestamp"])
                    if datetime.utcnow() - last_notification_time < timedelta(minutes=frequency_minutes):
                        continue

            lat = user["last_location"].get("lat")
            lon = user["last_location"].get("lon")
            radius_km = user.get("notification_radius", 100.0)

            seven_days_ago = datetime.utcnow() - timedelta(days=7)
            notified_ids = {
                item["external_id"] for item in last_notified
                if datetime.fromisoformat(item["timestamp"]) > seven_days_ago
            }
            check_ids = [eid for eid in external_ids if eid not in notified_ids]
            if not check_ids:
                continue

            nearby_results = {}
            for external_id in check_ids:
                try:
                    is_nearby = external_api.is_artwork_nearby(external_id, lat, lon, radius_km)
                    nearby_results[external_id] = is_nearby
                except Exception as e:
                    logger.error("Error checking artwork %s for user %s: %s", external_id, email, str(e))
                    continue

            nearby_artworks = []
            new_notified = []
            for external_id, is_nearby in nearby_results.items():
                if is_nearby:
                    try:
                        artwork = external_api.fetch_single_art_piece(external_id, user.get("level", "none"))
                        if artwork:
                            nearby_artworks.append(artwork)
                            new_notified.append({
                                "external_id": external_id,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                    except Exception as e:
                        logger.error("Error fetching artwork %s for user %s: %s", external_id, email, str(e))
                        continue

            if nearby_artworks:
                send_notification_email(email, nearby_artworks)
                try:
                    mongo.db.users.update_one(
                        {"email": email},
                        {"$push": {
                            "last_notified_artworks": {
                                "$each": new_notified,
                                "$slice": -100
                            }
                        }}
                    )
                except Exception as e:
                    logger.error("Error updating last_notified_artworks for user %s: %s", email, str(e))

    except Exception as e:
        logger.error("Unexpected error in check_nearby_artworks: %s", str(e))
        raise