import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient

load_dotenv(Path(__file__).parent / ".env")

_client = None
_collection = None


def short_reason(exc):
    lines = str(exc).splitlines() or [""]
    return f"{type(exc).__name__}: {lines[0][:120]}"


def connect_database():
    """Connect once, ping, create indexes. Returns (client, collection)."""
    global _client, _collection
    if _collection is not None:
        return _client, _collection

    uri = os.getenv("MONGO_URI")
    if not uri:
        raise RuntimeError("MONGO_URI not found in flask-api/.env")
    db_name = os.getenv("MONGO_DB", "doc_extract")

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
    except Exception as exc:
        print(f"MongoDB connection failed: {short_reason(exc)}")
        raise

    collection = client[db_name]["documents"]
    try:
        collection.create_index([("content_hash", ASCENDING)], unique=True)
        days = int(os.getenv("RETENTION_DAYS", "180"))
        collection.create_index(
            [("created_at", ASCENDING)], expireAfterSeconds=days * 86400
        )
    except Exception as exc:
        print(f"Warning: index creation skipped: {short_reason(exc)}")

    _client, _collection = client, collection
    print(f"MongoDB connected: {db_name}")
    return _client, _collection


def ping_database():
    try:
        if _client is None:
            connect_database()
        _client.admin.command("ping")
        return True
    except Exception:
        return False