from flask import Flask, jsonify, request
from dotenv import load_dotenv
from flask_dance.contrib.google import make_google_blueprint
from flask_restx import Api
from flask_cors import CORS
from flask_talisman import Talisman
from app.extensions import mongo, jwt
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.tasks.notify_users import check_nearby_artworks
import os

load_dotenv()

def create_app():
    app = Flask(__name__)

    app.config["MONGO_URI"] = os.getenv("MONGO_URI") + "&tls=true&tlsAllowInvalidCertificates=true"
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["GOOGLE_OAUTH_CLIENT_ID"] = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
    app.config["GOOGLE_OAUTH_CLIENT_SECRET"] = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

    app.url_map.strict_slashes = False

    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000"],
            "methods": ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "expose_headers": ["Content-Type", "Authorization"],
        }
    })

    @app.errorhandler(Exception)
    def handle_error(error):
        response = jsonify({"msg": str(error)})
        response.status_code = getattr(error, "code", 500)
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,PUT,OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        return response

    @app.route("/api/<path:path>", methods=["OPTIONS"])
    def handle_options(path):
        response = jsonify({"status": "ok"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,PUT,OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response, 200

    Talisman(app, content_security_policy={
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
        'style-src': ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        'img-src': ["'self'", "data:", "https://commons.wikimedia.org", "https://upload.wikimedia.org"],
        'connect-src': ["'self'", "http://localhost:5000", "https://accounts.google.com", "http://localhost:3000"]
    }, force_https=False if os.getenv("FLASK_ENV") == "development" else True)

    mongo.init_app(app)
    jwt.init_app(app)

    try:
        mongo.cx.server_info()
        print("✅ Connection successful to MongoDB Atlas")
    except Exception as e:
        print(f"❌ Error connecting to MongoDB Atlas: {e}")

    google_bp = make_google_blueprint(
        scope=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        redirect_to="auth_google_callback"
    )
    app.register_blueprint(google_bp, url_prefix="/api/auth")

    api = Api(
        app,
        version="1.0",
        title="Musaica API",
        description="Documentation of the API for the management of users and artworks",
        doc="/api/documentation"
    )
    
    from .routes.user import api as user_ns
    from .routes.artpiece import api as artpiece_ns
    from .routes.auth import api as auth_ns
    from .routes.forum import api as forum_ns

    api.add_namespace(user_ns, path="/api/user")
    api.add_namespace(artpiece_ns, path="/api/artpiece")
    api.add_namespace(auth_ns, path="/api/auth")
    api.add_namespace(forum_ns, path="/api/community")

    scheduler = BackgroundScheduler(timezone="Europe/Madrid")
    scheduler.add_job(
        check_nearby_artworks,
        trigger=CronTrigger(minute="*/5"),
        id="notify_users_daily",
        replace_existing=True
    )
    scheduler.start()
    print("✅ APScheduler started for daily notifications")

    import atexit
    atexit.register(lambda: scheduler.shutdown())

    return app