import smtplib
import secrets
import os
from email.message import EmailMessage
from flask import Blueprint, request, jsonify, url_for
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from app.extensions import mongo, bcrypt, limiter
from datetime import datetime,timedelta
import re
import time

auth_bp = Blueprint("auth", __name__)

failed_login_attempts = {}

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


def send_verification_email(email, token):
    msg = EmailMessage()
    msg["Subject"] = "Welcome to Musaica"
    msg["From"] = SMTP_EMAIL
    msg["To"] = email

    verify_link = url_for("auth.verify_email", token=token, _external=True)
    msg.set_content(f"Your gmail account has been registered in our platform, click on the link to verify your account if it was done by you: {verify_link}")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"✅ Email sent to {email}")
    except Exception as e:
        print(f"❌ Error sending email: {e}")

def send_password_reset_email(email, token):
    msg = EmailMessage()
    msg['Subject'] = "Reset your password for your Musaica account"
    msg['From'] = SMTP_EMAIL
    msg['To'] = email

    reset_link = url_for("auth.reset_password", token=token, _external=True)
    msg.set_content(f"Click the link to reset your password: {reset_link}")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"✅ Email sent to {email}")
    except Exception as e:
        print(f"❌ Error sending email: {e}")

@auth_bp.route("/register", methods=["POST"])
@limiter.limit("3 per minute")
def register():
    data = request.get_json()
    if not re.match(r"[^@]+@[^@]+\.[^@]+", data.get("email", "")):
        return jsonify({"msg": "Invalid email format"}), 400

    if len(data.get("password", "")) < 8:
        return jsonify({"msg": "Password must be at least 8 characters long"}), 400

    existing_user = mongo.db.users.find_one({"email": data["email"]})
    if existing_user:
        return jsonify({"msg": "User already exists"}), 400
    
    hashed_password = bcrypt.generate_password_hash(data["password"]).decode("utf-8")
    verification_token = secrets.token_urlsafe(32)
    
    user = {
        "email": data["email"],
        "password": hashed_password,
        "role": "user",
        "verified": False,
        "verification_token": verification_token
    }
    mongo.db.users.insert_one(user)

    send_verification_email(data["email"], verification_token)

    return jsonify({"msg": "User registered. Please verify your email."}), 201


@auth_bp.route("/verify/<token>", methods=["GET"])
def verify_email(token):
    user = mongo.db.users.find_one({"verification_token": token})
    if not user:
        return jsonify({"msg": "Invalid or expired token"}), 400
    
    mongo.db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"verified": True}, "$unset": {"verification_token": ""}}
    )
    return jsonify({"msg": "Email verified successfully. You can now log in."}), 200


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    data = request.get_json()
    email = data.get("email", "")

    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"msg": "Invalid email format"}), 400

    user = mongo.db.users.find_one({"email": email})

    if email in failed_login_attempts:
        attempts, last_attempt = failed_login_attempts[email]
        if attempts >= 5 and time.time() - last_attempt < 300:
            return jsonify({"msg": "Too many failed login attempts. Try again later."}), 403

    if user and bcrypt.check_password_hash(user["password"], data["password"]):
        if not user.get("verified", False):
            return jsonify({"msg": "Please verify your email before logging in."}), 403
        
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
    refresh_token = request.headers.get("Authorization").split(" ")[1] 

    user = mongo.db.users.find_one({"email": identity})

    if user:
        stored_tokens = user.get("refresh_tokens", [])
        if refresh_token in stored_tokens:
            stored_tokens.remove(refresh_token)
            mongo.db.users.update_one({"email": identity}, {"$set": {"refresh_tokens": stored_tokens}})

    return jsonify({"msg": "Logged out successfully"}), 200

@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("2 per minute")
def forgot_password():
    data = request.get_json()
    email = data.get("email", "")
    user = mongo.db.users.find_one({"email": email})

    if not user:
        return jsonify({"msg": "If the email exists, a reset link has been sent."}), 200

    token = secrets.token_urlsafe(32)
    expiration = datetime.utcnow() + timedelta(hours=1)

    mongo.db.users.update_one(
        {"email": email},
        {"$set": {
            "reset_token": token,
            "reset_token_expiration": expiration
        }}
    )
    send_password_reset_email(email, token)
    return jsonify({"msg": "If the email exists, a reset link has been sent."}), 200

@auth_bp.route("/reset-password/<token>", methods=["POST"])
@limiter.limit("2 per minute")
def reset_password(token):
    data = request.get_json()
    new_password = data.get("password", "")

    if len(new_password) < 8:
        return jsonify({"msg": "Password must be at least 8 characters long"}), 400

    user = mongo.db.users.find_one({"reset_token": token})
    if not user:
        return jsonify({"msg": "Invalid or expired token"}), 400

    expiration = user.get("reset_token_expiration")
    if not expiration or datetime.utcnow() > expiration:
        return jsonify({"msg": "Token has expired"}), 400

    hashed_password = bcrypt.generate_password_hash(new_password).decode("utf-8")

    mongo.db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hashed_password},
         "$unset": {"reset_token": "", "reset_token_expiration": ""}}
    )
    return jsonify({"msg": "Password reset successfully"}), 200
