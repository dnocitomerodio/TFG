from flask import request, jsonify
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token, create_refresh_token
import secrets
from datetime import datetime, timedelta
import re
import time
from app.extensions import mongo, bcrypt, limiter
from app.services.logger_service import log_user_action
from app.routes.auth import send_verification_email, send_password_reset_email

api = Namespace("auth", description="Authentication related operations")

user_model = api.model("User", {
    "email": fields.String(required=True, description="The email address of the user. This is unique and required for authentication."),
    "password": fields.String(required=True, description="The password for the user account. It should be securely hashed."),
    "role": fields.String(required=True, description="The new role to assign to the user (e.g., 'admin', 'user').")
})

@api.route("/register")
class Register(Resource):
    @limiter.limit("3 per minute")
    @api.expect(user_model, validate=True)
    def post(self):
        """Register a new user and send verification email
        - **No JWT required**.
        - **Any user** can register.
        """
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return {"msg": "Invalid email format"}, 400

        if len(password) < 8:
            return {"msg": "Password must be at least 8 characters long"}, 400

        if mongo.db.users.find_one({"email": email}):
            return {"msg": "User already exists"}, 400

        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
        token = secrets.token_urlsafe(32)

        user = {
            "email": email,
            "password": hashed_password,
            "role": "user",
            "verified": False,
            "verification_token": token
        }

        mongo.db.users.insert_one(user)
        send_verification_email(email, token)
        log_user_action(email, "registered")

        return {"msg": "User registered. Please verify your email."}, 201

@api.route("/verify/<string:token>")
class VerifyEmail(Resource):
    def get(self, token):
        """Verify email using token sent via email
        - **No JWT required**.
        - **Any user** can verify their email using the token received.
        """
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
    @api.expect(user_model, validate=True)
    def post(self):
        """Authenticate user and return access and refresh tokens
        - **No JWT required**.
        - **Any registered user** can log in to get an access token and refresh token.
        """
        data = request.get_json()
        email = data["email"]
        password = data["password"]

        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return {"msg": "Invalid email format"}, 400

        user = mongo.db.users.find_one({"email": email})
        if not user or not bcrypt.check_password_hash(user["password"], password):
            log_user_action(email, "login_failed")
            return {"msg": "Invalid credentials"}, 401

        if not user.get("verified", False):
            return {"msg": "Please verify your email before logging in."}, 403

        access_token = create_access_token(
            identity=email,
            additional_claims={"role": user["role"]},
            expires_delta=timedelta(minutes=30)
        )
        refresh_token = create_refresh_token(identity=email)

        tokens = user.get("refresh_tokens", [])
        tokens.append(refresh_token)
        if len(tokens) > 3:
            tokens.pop(0)

        mongo.db.users.update_one({"email": email}, {"$set": {"refresh_tokens": tokens}})
        log_user_action(email, "login_successful")

        return {"access_token": access_token, "refresh_token": refresh_token}, 200

@api.route("/refresh")
class TokenRefresh(Resource):
    @jwt_required(refresh=True)
    def post(self):
        """Refresh access token using a valid refresh token
        - **JWT required** (refresh token).
        - **Any authenticated user** can refresh their access token.
        """
        identity = get_jwt_identity()
        refresh_token = request.headers.get("Authorization").split(" ")[1]

        user = mongo.db.users.find_one({"email": identity})
        if not user or refresh_token not in user.get("refresh_tokens", []):
            return {"msg": "Invalid refresh token"}, 401

        new_access_token = create_access_token(
            identity=identity,
            additional_claims={"role": user["role"]},
            expires_delta=timedelta(minutes=30)
        )

        mongo.db.users.update_one({"email": identity}, {
            "$pull": {"refresh_tokens": refresh_token}
        })

        return {"access_token": new_access_token}, 200

@api.route("/logout")
class Logout(Resource):
    @jwt_required(refresh=True)
    def post(self):
        """Logout user and invalidate the refresh token
        - **JWT required** (refresh token).
        - **Any authenticated user** can log out by invalidating their refresh token.
        """
        identity = get_jwt_identity()
        refresh_token = request.headers.get("Authorization").split(" ")[1]

        mongo.db.users.update_one({"email": identity}, {
            "$pull": {"refresh_tokens": refresh_token}
        })

        log_user_action(identity, "logout")
        return {"msg": "Logged out successfully"}, 200

@api.route("/forgot-password")
class ForgotPassword(Resource):
    @limiter.limit("2 per minute")
    def post(self):
        """Send a password reset link to the user's email
        - **No JWT required**.
        - **Any user** can request a password reset, but they must provide the email.
        """
        email = request.json.get("email", "")
        user = mongo.db.users.find_one({"email": email})

        if user:
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

        return {"msg": "If the email exists, a reset link has been sent."}, 200

@api.route("/reset-password/<string:token>")
class ResetPassword(Resource):
    @limiter.limit("2 per minute")
    def post(self, token):
        """Reset user password using the reset token
        - **No JWT required**.
        - **Any user** with a valid reset token can reset their password.
        """
        new_password = request.json.get("password", "")

        if len(new_password) < 8:
            return {"msg": "Password must be at least 8 characters long"}, 400

        user = mongo.db.users.find_one({"reset_token": token})
        if not user or datetime.utcnow() > user.get("reset_token_expiration", datetime.utcnow()):
            return {"msg": "Invalid or expired token"}, 400

        hashed_password = bcrypt.generate_password_hash(new_password).decode("utf-8")
        mongo.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": hashed_password},
             "$unset": {"reset_token": "", "reset_token_expiration": ""}}
        )
        return {"msg": "Password reset successfully"}, 200
