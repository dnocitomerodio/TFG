from flask_pymongo import ObjectId
from datetime import datetime

class ArtPiece:
    def __init__(self, data):
        self._id = str(data.get("_id", ""))
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
        return {
            "_id": self._id,
            "title": self.title,
            "author": self.author,
            "year": self.year,
            "style": self.style,
            "museum": self.museum,
            "location": self.location,
            "medium": self.medium,
            "dimensions": self.dimensions,
            "image": self.image,
            "description": self.description,
            "tags": self.tags,
            "external_id": self.external_id,
            "source_url": self.source_url
        }

class User:
    def __init__(self, data):
        self.id = str(data.get("_id", ""))
        self.email = data.get("email")
        self.level = data.get("level")
        self.password = data.get("password")
        self.role = data.get("role", "user")
        self.artpieces = data.get("artpieces", [])
        self.notifications_enabled = data.get("notifications_enabled", True)
        self.notification_frequency = data.get("notification_frequency", 60) 
        self.notification_radius = data.get("notification_radius", 100.0)
        self.last_location = data.get("last_location", {}) 
        self.last_notified_artworks = data.get("last_notified_artworks", [])

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "level": self.level,
            "role": self.role,
            "artpieces": self.artpieces,
            "notifications_enabled": self.notifications_enabled,
            "notification_frequency": self.notification_frequency,
            "notification_radius": self.notification_radius,
            "last_location": self.last_location,
            "last_notified_artworks": self.last_notified_artworks
        }