from flask import Flask, jsonify, request, url_for
from dotenv import load_dotenv
from flask_dance.contrib.google import make_google_blueprint, google
from app.extensions import mongo
import os
from .extensions import mongo, jwt
from flask_cors import CORS
from flask_talisman import Talisman

load_dotenv()

def create_app():
    app = Flask(__name__)

    app.config["MONGO_URI"] = os.getenv("MONGO_URI") + "&tls=true&tlsAllowInvalidCertificates=true"
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["GOOGLE_OAUTH_CLIENT_ID"] = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
    app.config["GOOGLE_OAUTH_CLIENT_SECRET"] = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

    google_bp = make_google_blueprint(
        scope=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        redirect_to="auth.google_login_callback"
    )

    CORS(app, resources={r"/*": {"origins": "*"}})
    Talisman(app)

    @app.before_request
    def before_request():
        if not request.is_secure and os.getenv("FLASK_ENV") != "development":
            return jsonify({"msg": "HTTPS required"}), 403

    mongo.init_app(app)
    jwt.init_app(app)

    try:
        mongo.cx.server_info()
        print("✅ Connection successful to MongoDB Atlas")
        print(f"📊 Databases available: {mongo.cx.list_database_names()}")
        print(f"🗂️ Using database: {mongo.db}")
    except Exception as e:
        print(f"❌ Error connecting to MongoDB Atlas: {e}")


    from .routes.auth import auth_bp
    from .routes.artpiece import artpiece_bp
    from .routes.user import user_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(artpiece_bp, url_prefix="/artpiece")
    app.register_blueprint(user_bp, url_prefix="/user")
    app.register_blueprint(google_bp, url_prefix="/auth/")

    return app
