"""
app.py — Python Flask Bridge Server (replaces server.js)
Exposes the enrichment pipeline as an HTTP API for Railway deployment.
"""

import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

app = Flask(__name__)
CORS(app, origins=["https://intelsync-ai.vercel.app", "http://localhost:5173", "http://localhost:5174"])


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "IntelSync AI Python Pipeline"})


@app.route("/enrich", methods=["POST"])
def enrich():
    data = request.get_json(force=True)
    name       = data.get("name")
    company_id = data.get("companyId")
    website    = data.get("websiteUrl", "")

    if not name or not company_id:
        return jsonify({"success": False, "message": "name and companyId required"}), 400

    print(f"\n🔬 ENRICHMENT REQUEST: {name} (ID: {company_id})", flush=True)

    try:
        # Import here so env vars are loaded first
        from enrichment.enrich_company import enrich_and_save
        enrich_and_save(name, company_id, website)
        print(f"✅ Enrichment complete for {name}", flush=True)
        return jsonify({"success": True, "message": f"Enrichment complete for {name}"})
    except Exception as e:
        print(f"❌ Enrichment failed for {name}: {e}", flush=True)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/ingest", methods=["POST"])
def ingest():
    data = request.get_json(force=True)
    raw_text = data.get("rawText")

    if not raw_text:
        return jsonify({"success": False, "message": "rawText required"}), 400

    try:
        from enrichment.ingest_parser import parse_raw_text
        result = parse_raw_text(raw_text)
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/freshness", methods=["POST"])
def freshness():
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, os.path.join(os.path.dirname(__file__), "enrichment", "freshness_engine.py")],
            capture_output=True, text=True, timeout=600,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}
        )
        return jsonify({
            "success": result.returncode == 0,
            "message": "Freshness check complete" if result.returncode == 0 else "Freshness check failed",
            "output": result.stdout
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🐍 IntelSync AI Flask Pipeline running on port {port}", flush=True)
    app.run(host="0.0.0.0", port=port, threaded=True)
