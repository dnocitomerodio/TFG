from flask import Flask, jsonify, request
from dotenv import load_dotenv
from flask_dance.contrib.google import make_google_blueprint, google
from flask_restx import Api
from flask_cors import CORS
from flask_talisman import Talisman
from app.extensions import mongo, jwt
import os

load_dotenv()

def create_app():
    app = Flask(__name__)

    app.config["MONGO_URI"] = os.getenv("MONGO_URI") + "&tls=true&tlsAllowInvalidCertificates=true"
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["GOOGLE_OAUTH_CLIENT_ID"] = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
    app.config["GOOGLE_OAUTH_CLIENT_SECRET"] = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

    CORS(app, resources={r"/*": {"origins": "*"}})
    Talisman(app,content_security_policy={
    'default-src': ['\'self\''],
    'script-src': ['\'self\'', '\'unsafe-inline\''],
    'style-src': ['\'self\'', '\'unsafe-inline\''],
    'img-src': ['\'self\'', 'data:']
    })

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

    google_bp = make_google_blueprint(
        scope=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        redirect_to="auth.google_login_callback"
    )
    app.register_blueprint(google_bp, url_prefix="/auth/")

    api = Api(
        app,
        version="1.0",
        title="Musaica API",
        description="Documentation of the API for the management of users and artworks",
        doc="/"
    )
    
    from .routes.user import api as user_ns
    from .routes.artpiece import api as artpiece_ns
    from .routes.auth import api as auth_ns

    api.add_namespace(user_ns, path="/user")
    api.add_namespace(artpiece_ns, path="/artpiece")
    api.add_namespace(auth_ns, path="/auth")

    return app
