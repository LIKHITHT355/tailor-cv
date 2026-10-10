import hashlib
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from pymongo.errors import DuplicateKeyError, PyMongoError
from rapidocr_onnxruntime import RapidOCR

from db import connect_database, ping_database, short_reason
from errors import ExtractionError
from extractors.document import extract_document

BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / ".env"
load_dotenv(env_path)

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("api")

# Dev only: prints the full extracted text in the terminal. Resume text is personal data.
LOG_EXTRACTED_TEXT = os.getenv("LOG_EXTRACTED_TEXT", "true").lower() == "true"
if LOG_EXTRACTED_TEXT:
    print("WARNING: LOG_EXTRACTED_TEXT is on, extracted text is printed in the terminal", flush=True)

if not env_path.is_file() and not os.getenv("MONGO_URI"):
    print(f"Error: {env_path} not found and MONGO_URI not set.", file=sys.stderr)
    sys.exit(1)

try:
    ocr_engine = RapidOCR()
except Exception as exc:
    print(f"Failed to load OCR model: {exc}", file=sys.stderr)
    ocr_engine = None

ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".xlsx", ".xls", ".csv", ".tex", ".txt",
    ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff",
}

ADDON_SECTIONS = {"skills", "certification", "experience", "project"}


def normalize_addons(value):
    if not isinstance(value, list):
        raise ValueError("addons must be a list")
    if len(value) > 10:
        raise ValueError("addons cannot contain more than 10 items")

    addons = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("each add-on must be an object")
        section = item.get("section")
        text = item.get("text")
        if section not in ADDON_SECTIONS:
            raise ValueError("add-on section must be skills, certification, experience, or project")
        if not isinstance(text, str):
            raise ValueError("add-on text must be a string")
        text = text.strip()
        if len(text) > 2000:
            raise ValueError("add-on text cannot exceed 2000 characters")
        if text:
            addons.append({"section": section, "text": text})
    return addons


def extension(filename):
    return os.path.splitext(filename)[1].lower()


def methods_of(pages):
    return sorted({p.get("method") for p in pages if p.get("method")})


def output(document):
    return {
        "id": str(document["_id"]),
        "filename": document["filename"],
        "text": document["text"],
        "page_count": document["page_count"],
        "pages": document["pages"],
        "links": document.get("links", {"linkedin": None, "github": None, "other": []}),
        "addons": document.get("addons", []),
    }


def summary(document):
    return {
        "id": str(document["_id"]),
        "filename": document["filename"],
        "page_count": document["page_count"],
        "created_at": document["created_at"].isoformat(),
    }


def print_extracted(filename, pages, text, content_hash):
    bar = "=" * 72
    print(bar, flush=True)
    print(f"[EXTRACT] {datetime.now(timezone.utc).isoformat()}", flush=True)
    print(f"file={filename} pages={len(pages)} methods={methods_of(pages)} "
          f"chars={len(text)} hash={content_hash[:16]}", flush=True)
    for idx, page in enumerate(pages, start=1):
        print(f"--- page {idx} ({page.get('method', 'unknown')}) ---", flush=True)
        print(page.get("text", ""), flush=True)
        for t_idx, table in enumerate(page.get("tables", []), start=1):
            print(f"[table {t_idx}]", flush=True)
            for row in table:
                print(" | ".join("" if c is None else str(c) for c in row), flush=True)
    print("[EXTRACT] END", flush=True)
    print(bar, flush=True)


def create_app(collection=None, mongo_client=None):
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024
    CORS(app, origins=[os.getenv("ALLOWED_ORIGIN", "http://localhost:8081")])
    app.config["COLLECTION"] = collection
    app.config["MONGO_CLIENT"] = mongo_client

    if app.config["COLLECTION"] is None or app.config["MONGO_CLIENT"] is None:
        client, coll = connect_database()
        app.config["MONGO_CLIENT"] = client
        app.config["COLLECTION"] = coll

    def documents():
        return app.config["COLLECTION"]

    def database_unavailable(error):
        log.error("MongoDB request failure: %s", short_reason(error))
        return jsonify(error=f"Database unavailable: {short_reason(error)}"), 503

    @app.before_request
    def start_timer():
        g.start = time.time()

    @app.after_request
    def log_request(response):
        ms = int((time.time() - g.get("start", time.time())) * 1000)
        print(f"[REQUEST] {request.method} {request.path} -> {response.status_code} ({ms} ms)", flush=True)
        return response

    @app.errorhandler(413)
    def too_large(_):
        return jsonify(error="File exceeds 25 MB limit"), 413

    @app.errorhandler(404)
    def not_found(_):
        return jsonify(error="Route not found"), 404

    @app.errorhandler(405)
    def method_not_allowed(_):
        return jsonify(error="Method not allowed"), 405

    @app.errorhandler(500)
    def internal_error(error):
        log.error("Unhandled server error: %s", short_reason(error))
        return jsonify(error="Internal server error"), 500

    @app.get("/health")
    def health():
        return jsonify(ok=True)

    @app.get("/health/deps")
    def dependency_health():
        client = app.config["MONGO_CLIENT"]
        if client is not None:
            try:
                client.admin.command("ping")
                mongo_ok = True
            except PyMongoError as err:
                log.error("MongoDB health failure: %s", short_reason(err))
                mongo_ok = False
        else:
            mongo_ok = ping_database()
        return jsonify(flask=True, mongo=mongo_ok, ocr=ocr_engine is not None)

    @app.post("/api/extract")
    def extract():
        started = time.time()

        if "file" not in request.files or not request.files["file"].filename:
            return jsonify(error="A file is required"), 400
        upload = request.files["file"]
        if extension(upload.filename) not in ALLOWED_EXTENSIONS:
            return jsonify(error="Unsupported file type"), 415

        data = upload.read()
        try:
            pages = extract_document(upload.filename, data, ocr_engine)
        except ExtractionError as exc:
            status = getattr(exc, "status_code", getattr(exc, "status", 422))
            log.error("Extraction rejected (%s): %s", status, exc)
            return jsonify(error=str(exc)), status
        except Exception as exc:
            log.error("Extraction failed: %s", short_reason(exc))
            return jsonify(error="Extraction failed"), 502

        text = "\n\n".join(p.get("text", "") for p in pages).strip()
        if not text:
            return jsonify(error="No text could be extracted"), 422

        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        if LOG_EXTRACTED_TEXT:
            try:
                print_extracted(upload.filename, pages, text, content_hash)
            except Exception as err:
                log.warning("Could not print extracted text: %s", err)

        def meta(duplicate):
            ms = int((time.time() - started) * 1000)
            log.info(
                "[EXTRACT_META] filename=%s size=%d pages=%d methods=%s chars=%d duplicate=%s duration_ms=%d",
                upload.filename, len(data), len(pages), methods_of(pages), len(text), duplicate, ms,
            )

        try:
            existing = documents().find_one({"content_hash": content_hash})
            if existing:
                meta(True)
                return jsonify(output(existing))

            document = {
                "filename": upload.filename,
                "text": text,
                "pages": pages,
                "page_count": len(pages),
                "methods_used": methods_of(pages),
                "content_hash": content_hash,
                "created_at": datetime.now(timezone.utc),
            }
            document["_id"] = documents().insert_one(document).inserted_id
            meta(False)
            return jsonify(output(document))
        except DuplicateKeyError:
            try:
                existing = documents().find_one({"content_hash": content_hash})
                meta(True)
                return jsonify(output(existing))
            except PyMongoError as err:
                return database_unavailable(err)
        except PyMongoError as err:
            return database_unavailable(err)

    @app.get("/api/documents/<document_id>")
    def get_document(document_id):
        if not ObjectId.is_valid(document_id):
            return jsonify(error="Invalid document id"), 400
        try:
            document = documents().find_one({"_id": ObjectId(document_id)})
        except PyMongoError as err:
            return database_unavailable(err)
        if not document:
            return jsonify(error="Document not found"), 404
        return jsonify(output(document))

    @app.get("/api/documents")
    def list_documents():
        try:
            records = (
                documents()
                .find({}, {"filename": 1, "page_count": 1, "created_at": 1})
                .sort("created_at", -1)
                .limit(100)
            )
            return jsonify([summary(doc) for doc in records])
        except PyMongoError as err:
            return database_unavailable(err)

    @app.delete("/api/documents/<document_id>")
    def delete_document(document_id):
        if not ObjectId.is_valid(document_id):
            return jsonify(error="Invalid document id"), 400
        try:
            documents().delete_one({"_id": ObjectId(document_id)})
        except PyMongoError as err:
            return database_unavailable(err)
        return jsonify(deleted=True)

    @app.patch("/api/documents/<document_id>/links")
    def update_links(document_id):
        if not ObjectId.is_valid(document_id):
            return jsonify(error="Invalid document id"), 400
        try:
            payload = request.get_json(silent=True) or {}
            if not isinstance(payload, dict):
                return jsonify(error="Request body must be an object"), 400
            # Persist the link values exactly as provided. They are free-form
            # strings, so this route deliberately performs no URL cleanup or
            # validation (including no trimming, scheme insertion, filtering,
            # deduplication, or domain checks).
            has_links = any(key in payload for key in ("linkedin", "github", "other"))
            addons = normalize_addons(payload["addons"]) if "addons" in payload else None
            if not has_links and addons is None:
                return jsonify(error="Provide links or addons to save"), 400

            updates = {}
            if has_links:
                linkedin = payload.get("linkedin")
                github = payload.get("github")
                other = payload.get("other", [])
                updates["links"] = {
                    "linkedin": linkedin,
                    "github": github,
                    "other": other,
                }
            if addons is not None:
                updates["addons"] = addons
            result = documents().update_one({"_id": ObjectId(document_id)}, {"$set": updates})
            if result.matched_count == 0:
                return jsonify(error="Document not found"), 404
            if has_links:
                log.info(
                    "[LINKS_SAVED] id=%s linkedin=%s github=%s other_count=%d",
                    document_id,
                    "present" if linkedin else "none",
                    "present" if github else "none",
                    len(other) if isinstance(other, list) else 0,
                )
            if addons is not None:
                log.info("[ADDONS_SAVED] id=%s count=%d", document_id, len(addons))
            doc = documents().find_one({"_id": ObjectId(document_id)})
            return jsonify({
                "links": doc.get("links", {"linkedin": None, "github": None, "other": []}),
                "addons": doc.get("addons", []),
            })
        except ValueError as exc:
            return jsonify(error=str(exc)), 400
        except Exception as exc:
            log.error("Failed to save links: %s", short_reason(exc))
            return jsonify(error="Failed to save links"), 500

    return app


if __name__ == "__main__":
    try:
        client, collection = connect_database()
    except Exception:
        sys.exit(1)  # db.py already printed the reason
    app = create_app(collection, client)
    print("Flask API running on http://127.0.0.1:5000", flush=True)
    try:
        from waitress import serve
        serve(app, host="127.0.0.1", port=5000, threads=4)
    except ImportError:
        app.run(host="127.0.0.1", port=5000, threaded=True)
