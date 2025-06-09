import smtplib
import secrets
import os
from datetime import datetime, timedelta
from email.message import EmailMessage
from flask import redirect, request, url_for
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from flask_dance.contrib.google import google
from app.extensions import mongo, bcrypt, limiter
from app.services.logger_service import log_user_action
import re
import time
from flask_restx import Namespace, Resource

api = Namespace("auth", description="Authentication related operations")

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

failed_login_attempts = {}

def send_verification_email(email, token):
    msg = EmailMessage()
    msg["Subject"] = "Welcome to Musaica"
    msg["From"] = SMTP_EMAIL
    msg["To"] = email
    verify_link = url_for("auth.verify_email", token=token, _external=True)
    msg.set_content(f"Your gmail account has been registered in our platform. Click to verify: {verify_link}")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"✅ Verification email sent to {email}")
    except Exception as e:
        print(f"❌ Error sending verification email: {e}")

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
        print(f"✅ Password reset email sent to {email}")
    except Exception as e:
        print(f"❌ Error sending password reset email: {e}")

@api.route("/register")
class Register(Resource):
    @limiter.limit("3 per minute")
    def post(self):
        data = request.get_json()
        email = data.get("email", "")

        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return {"msg": "Invalid email format"}, 400
        if len(data.get("password", "")) < 8:
            return {"msg": "Password must be at least 8 characters long"}, 400
        if mongo.db.users.find_one({"email": email}):
            return {"msg": "User already exists"}, 400

        hashed_password = bcrypt.generate_password_hash(data["password"]).decode("utf-8")
        verification_token = secrets.token_urlsafe(32)

        mongo.db.users.insert_one({
            "email": email,
            "password": hashed_password,
            "role": "user",
            "level":"none",
            "verified": False,
            "verification_token": verification_token
        })

        log_user_action(email, "registered")
        send_verification_email(email, verification_token)

        return {"msg": "User registered. Please verify your email."}, 201

@api.route("/verify/<token>")
class VerifyEmail(Resource):
    def get(self, token):
        user = mongo.db.users.find_one({"verification_token": token})
        if not user:
            return {"msg": "Invalid or expired token"}, 400

        mongo.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"verified": True}, "$unset": {"verification_token": ""}}
        )

        log_user_action(user["email"], "email_verified")
        return {"msg": "Email verified successfully. You can now log in."}, 200

@api.route("/login")
class Login(Resource):
    @limiter.limit("5 per minute")
    def post(self):
        data = request.get_json()
        email = data.get("email", "")
        user = mongo.db.users.find_one({"email": email})

        if email in failed_login_attempts:
            attempts, last = failed_login_attempts[email]
            if attempts >= 5 and time.time() - last < 300:
                log_user_action(email, "login_blocked_due_to_rate_limit")
                return {"msg": "Too many failed login attempts. Try again later."}, 403

        if user and bcrypt.check_password_hash(user["password"], data.get("password", "")):
            if not user.get("verified", False):
                log_user_action(email, "login_rejected_unverified")
                return {"msg": "Please verify your email before logging in."}, 403

            access_token = create_access_token(identity=email, additional_claims={"role": user.get("role", "user")}, expires_delta=timedelta(minutes=30))
            refresh_token = create_refresh_token(identity=email)

            refresh_tokens = user.get("refresh_tokens", [])
            refresh_tokens.append(refresh_token)
            if len(refresh_tokens) > 3:
                refresh_tokens.pop(0)

            mongo.db.users.update_one({"email": email}, {"$set": {"refresh_tokens": refresh_tokens}})

            failed_login_attempts.pop(email, None)
            log_user_action(email, "login_successful")
            return {"access_token": access_token, "refresh_token": refresh_token}, 200

        failed_login_attempts[email] = (failed_login_attempts.get(email, (0, 0))[0] + 1, time.time())
        log_user_action(email, "login_failed")
        return {"msg": "Invalid credentials"}, 401

@api.route("/refresh")
class RefreshToken(Resource):
    @jwt_required(refresh=True)
    def post(self):
        identity = get_jwt_identity()
        refresh_token = request.headers.get("Authorization").split(" ")[1]

        user = mongo.db.users.find_one({"email": identity})
        if not user:
            return {"msg": "User not found"}, 401

        stored_tokens = user.get("refresh_tokens", [])
        if refresh_token not in stored_tokens:
            return {"msg": "Invalid refresh token"}, 401

        new_token = create_access_token(identity=identity, additional_claims={"role": user["role"]}, expires_delta=timedelta(minutes=30))

        stored_tokens.remove(refresh_token)
        mongo.db.users.update_one({"email": identity}, {"$set": {"refresh_tokens": stored_tokens}})

        return {"access_token": new_token}, 200

@api.route("/logout")
class Logout(Resource):
    @jwt_required(refresh=True)
    def post(self):
        identity = get_jwt_identity()
        refresh_token = request.headers.get("Authorization").split(" ")[1]

        user = mongo.db.users.find_one({"email": identity})
        if user:
            tokens = user.get("refresh_tokens", [])
            if refresh_token in tokens:
                tokens.remove(refresh_token)
                mongo.db.users.update_one({"email": identity}, {"$set": {"refresh_tokens": tokens}})

        log_user_action(identity, "logout")
        return {"msg": "Logged out successfully"}, 200

@api.route("/forgot-password")
class ForgotPassword(Resource):
    @limiter.limit("2 per minute")
    def post(self):
        data = request.get_json()
        email = data.get("email", "")
        user = mongo.db.users.find_one({"email": email})

        if user:
            token = secrets.token_urlsafe(32)
            expiration = datetime.utcnow() + timedelta(hours=1)

            mongo.db.users.update_one(
                {"email": email},
                {"$set": {"reset_token": token, "reset_token_expiration": expiration}}
            )
            send_password_reset_email(email, token)

        return {"msg": "If the email exists, a reset link has been sent."}, 200

@api.route("/reset-password/<token>")
class ResetPassword(Resource):
    @limiter.limit("2 per minute")
    def post(self, token):
        data = request.get_json()
        new_password = data.get("password", "")

        if len(new_password) < 8:
            return {"msg": "Password must be at least 8 characters long"}, 400

        user = mongo.db.users.find_one({"reset_token": token})
        if not user or not user.get("reset_token_expiration") or datetime.utcnow() > user["reset_token_expiration"]:
            return {"msg": "Invalid or expired token"}, 400

        hashed_password = bcrypt.generate_password_hash(new_password).decode("utf-8")
        mongo.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": hashed_password},
             "$unset": {"reset_token": "", "reset_token_expiration": ""}}
        )
        return {"msg": "Password reset successfully"}, 200

@api.route("/google/callback")
class GoogleCallback(Resource):
    def get(self):
        if not google.authorized:
            return redirect(url_for("google.login"))

        resp = google.get("/oauth2/v2/userinfo")
        if not resp.ok:
            return {"msg": "Error fetching user info"}, 400

        user_info = resp.json()
        email = user_info["email"]
        user = mongo.db.users.find_one({"email": email})

        if not user:
            user = {
                "email": email,
                "role": "user",
                "verified": True,
                "artpieces": [],
                "refresh_tokens": []
            }
            mongo.db.users.insert_one(user)
            log_user_action(email, "user created successfully with google")

        access_token = create_access_token(identity=email, expires_delta=timedelta(days=1))
        refresh_token = create_refresh_token(identity=email)

        stored_tokens = user.get("refresh_tokens", [])
        stored_tokens.append(refresh_token)
        if len(stored_tokens) > 3:
            stored_tokens.pop(0)

        mongo.db.users.update_one({"email": email}, {"$set": {"refresh_tokens": stored_tokens}})
        log_user_action(email, "login successfull with google")

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "msg": "Login with Google successful"
        }
