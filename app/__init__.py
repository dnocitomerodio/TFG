from flask import Flask
from dotenv import load_dotenv
import os
from .extensions import mongo, jwt

load_dotenv()

def create_app():
    app = Flask(__name__)

    app.config["MONGO_URI"] = os.getenv("MONGO_URI")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

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

    return app
