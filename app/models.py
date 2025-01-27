from flask_pymongo import ObjectId

class ArtPiece:
    def __init__(self, data):
        self.title = data.get("title")
        self.author = data.get("author")
        self.year = data.get("year")
        self.style = data.get("style")
        self.museum = data.get("museum")
        self.image = data.get("image", "")
        self.description = data.get("description", "")
        self.external_id = data.get("external_id", "")

    def to_dict(self):
        return {
            "title": self.title,
            "author": self.author,
            "year": self.year,
            "style": self.style,
            "museum": self.museum,
            "image": self.image,
            "description": self.description,
            "external_id": self.external_id,
        }

class User:
    def __init__(self, data):
        self.email = data.get("email")
        self.password = data.get("password")
        self.role = data.get("role", "user")

    def to_dict(self):
        return {
            "email": self.email,
            "role": self.role,
        }
