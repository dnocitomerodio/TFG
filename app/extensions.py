from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

mongo = PyMongo()
jwt = JWTManager()
bcrypt = Bcrypt()
limiter = Limiter(get_remote_address)
