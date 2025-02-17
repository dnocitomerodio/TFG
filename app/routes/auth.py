from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from app.extensions import mongo, bcrypt 

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    existing_user = mongo.db.users.find_one({"email": data["email"]})
    if existing_user:
        return jsonify({"msg": "User already exists"}), 400
    
    hashed_password = bcrypt.generate_password_hash(data["password"]).decode("utf-8")
    user = {
        "email": data["email"],
        "password": hashed_password,
        "role": "user",
        "artpieces": []
    }

    mongo.db.users.insert_one(user)
    return jsonify({"msg": "User registered successfully"}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = mongo.db.users.find_one({"email": data["email"]})

    if user and bcrypt.check_password_hash(user["password"], data["password"]):
        access_token = create_access_token(identity=user["email"], additional_claims={"role": user["role"]})
        return jsonify({"access_token": access_token}), 200

    return jsonify({"msg": "Invalid credentials"}), 401
