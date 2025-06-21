import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
import os
from app.extensions import mongo
from app.services.external_api import ExternalAPI
from app.services.logger_service import log_user_action

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

external_api = ExternalAPI("https://query.wikidata.org/sparql")

def send_notification_email(email, nearby_artworks):
    """Send an email listing nearby artworks to the user."""
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
        log_user_action(email, f"Failed to send notification email: {str(e)}")

def check_nearby_artworks():
    """Check for nearby artworks for all eligible users and send notifications. Scheduled to run daily."""
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

        lat = user["last_location"].get("lat")
        lon = user["last_location"].get("lon")
        radius_km = user.get("notification_radius", 100.0)
        last_notified = user.get("last_notified_artworks", [])

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
            except Exception:
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
                except Exception:
                    continue

        if nearby_artworks:
            send_notification_email(email, nearby_artworks)
            mongo.db.users.update_one(
                {"email": email},
                {"$push": {
                    "last_notified_artworks": {
                        "$each": new_notified,
                        "$slice": -100
                    }
                }}
            )