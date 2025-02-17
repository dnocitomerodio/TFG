from flask_pymongo import ObjectId

class ArtPiece:
    def __init__(self, data):
        self.title = data.get("title")
        self.author = data.get("author")
        self.year = data.get("year")
        self.style = data.get("style")
        self.museum = data.get("museum")
        self.location = data.get("location", {})
        self.medium = data.get("medium", "")
        self.dimensions = data.get("dimensions", "") 
        self.image = data.get("image", "")
        self.description = data.get("description", "")
        self.tags = data.get("tags", []) 
        self.external_id = data.get("external_id", "")
        self.source_url = data.get("source_url", "")

    def to_dict(self):
        return vars(self)


class User:
    def __init__(self, data):
        self.id = str(data.get("_id", ""))
        self.email = data.get("email")
        self.password = data.get("password")
        self.role = data.get("role", "user")
        self.saved_artworks = data.get("saved_artworks", []) 

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "saved_artworks": self.saved_artworks,
        }
