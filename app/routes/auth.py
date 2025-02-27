from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from app.extensions import mongo, bcrypt
from datetime import timedelta
import re
import time

auth_bp = Blueprint("auth", __name__)

failed_login_attempts = {}

def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    if not is_valid_email(data.get("email", "")):
        return jsonify({"msg": "Invalid email format"}), 400

    if len(data.get("password", "")) < 8:
        return jsonify({"msg": "Password must be at least 8 characters long"}), 400

    existing_user = mongo.db.users.find_one({"email": data["email"]})
    if existing_user:
        return jsonify({"msg": "User already exists"}), 400
    
    hashed_password = bcrypt.generate_password_hash(data["password"], rounds=12).decode("utf-8")
    
    user = {
        "email": data["email"],
        "password": hashed_password,
        "role": "user",
        "artpieces": [],
        "refresh_tokens": []
    }

    mongo.db.users.insert_one(user)
    return jsonify({"msg": "User registered successfully"}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "")

    if not is_valid_email(email):
        return jsonify({"msg": "Invalid email format"}), 400

    user = mongo.db.users.find_one({"email": email})

    if email in failed_login_attempts:
        attempts, last_attempt = failed_login_attempts[email]
        if attempts >= 5 and time.time() - last_attempt < 300:
            return jsonify({"msg": "Too many failed login attempts. Try again later."}), 403

    if user and bcrypt.check_password_hash(user["password"], data["password"]):
        access_token = create_access_token(
            identity=user["email"],
            additional_claims={"role": user["role"]},
            expires_delta=timedelta(minutes=30)
        )
        refresh_token = create_refresh_token(identity=user["email"])

        refresh_tokens = user.get("refresh_tokens", [])
        refresh_tokens.append(refresh_token)
        if len(refresh_tokens) > 3:
            refresh_tokens.pop(0)

        mongo.db.users.update_one({"email": email}, {"$set": {"refresh_tokens": refresh_tokens}})

        if email in failed_login_attempts:
            del failed_login_attempts[email]

        return jsonify({"access_token": access_token, "refresh_token": refresh_token}), 200

    if email in failed_login_attempts:
        failed_login_attempts[email] = (failed_login_attempts[email][0] + 1, time.time())
    else:
        failed_login_attempts[email] = (1, time.time())

    return jsonify({"msg": "Invalid credentials"}), 401

@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh_token():
    identity = get_jwt_identity()
    refresh_token = request.headers.get("Authorization").split(" ")[1]

    user = mongo.db.users.find_one({"email": identity})
    
    if not user:
        return jsonify({"msg": "User not found"}), 401

    stored_tokens = user.get("refresh_tokens", [])

    if refresh_token not in stored_tokens:
        return jsonify({"msg": "Invalid refresh token"}), 401

    new_access_token = create_access_token(
        identity=identity,
        additional_claims={"role": user["role"]},
        expires_delta=timedelta(minutes=30)
    )

    stored_tokens.remove(refresh_token)
    mongo.db.users.update_one({"email": identity}, {"$set": {"refresh_tokens": stored_tokens}})

    return jsonify({"access_token": new_access_token}), 200

@auth_bp.route("/logout", methods=["POST"])
@jwt_required(refresh=True)
def logout():
    identity = get_jwt_identity()
    refresh_token = request.headers.get("Authorization").split(" ")[1]  # Obtener el token enviado

    user = mongo.db.users.find_one({"email": identity})

    if user:
        stored_tokens = user.get("refresh_tokens", [])
        if refresh_token in stored_tokens:
            stored_tokens.remove(refresh_token)
            mongo.db.users.update_one({"email": identity}, {"$set": {"refresh_tokens": stored_tokens}})

    return jsonify({"msg": "Logged out successfully"}), 200
