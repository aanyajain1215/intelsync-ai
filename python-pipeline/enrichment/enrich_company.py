"""
enrich_company.py — MASTER ORCHESTRATOR v11.0
==============================================
Central controller of the IntelSync AI engine.
Coordinates 7 self-sufficient specialized modules.
Each module runs its own dedicated searches — no shared context bleed.

Architecture:
  Phase 1: Identity Grounding        (Module 1 — sequential, gates everything)
  Phase 2: Parallel Execution        (Modules 2, 3, 4, 5, 6, 7 — concurrent)
  Phase 3: Assembly & MongoDB Save   (Schema-aligned field mapping)
"""

import os
import sys
import time
import argparse
import pymongo
import concurrent.futures
from datetime import datetime, timezone
from bson import ObjectId

# -- Load env ---------------------------------------------------------------
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# -- Import Specialized Modules ---------------------------------------------
from enrichment.module_1_identity   import audit_identity
from enrichment.module_2_status     import audit_status, calculate_freshness
from enrichment.module_3_contact    import audit_contacts
from enrichment.module_4_leadership import audit_leadership
from enrichment.module_5_financials import audit_financials
from enrichment.module_6_signals    import audit_signals
from enrichment.module_7_documents  import audit_documents


# ==========================================================================
def enrich_and_save(company_name, company_id, website_url=""):
    """
    Main enrichment function.
    Runs all 6 modules, assembles the result, and saves to MongoDB.
    """
    print(f"\n{'='*65}")
    print(f"  [*] IntelSync AI v11.0 - Modular Audit")
    print(f"  Company : {company_name}")
    print(f"  ID      : {company_id}")
    print(f"{'='*65}")
    start_time = time.time()

    # -- MongoDB Connection -------------------------------------------------
    mongo_uri = os.environ.get("MONGO_URI", "")
    if not mongo_uri:
        print("  ERR MONGO_URI not set. Aborting.")
        sys.exit(1)

    mongo_client = pymongo.MongoClient(mongo_uri)
    db = mongo_client.get_database()
    collection = db["companies"]

    # ----------------------------------------------------------------------
    # PHASE 1: IDENTITY GROUNDING (Sequential — all other phases depend on this)
    # ----------------------------------------------------------------------
    print("\n  >> Phase 1: Identity Grounding...")
    try:
        identity = audit_identity(company_name, website_url)
    except Exception as e:
        print(f"  WARN  Module 1 (Identity) failed: {e}")
        identity = {
            "name": company_name,
            "domain": None, "sepcStrategicDomain": None,
            "subCategory": None, "isSepcRelevant": False,
            "description": None,
            "_groundStatus": "active", "_groundExplanation": "",
            "_searchUrl": website_url or "", "_legalName": company_name,
        }

    legal_name  = identity["_legalName"]
    search_url  = identity["_searchUrl"]
    ground_stat = identity["_groundStatus"]
    ground_expl = identity["_groundExplanation"]

    # Derive domain-only for site-specific dorks
    domain_only = ""
    if search_url:
        domain_only = (
            search_url.replace("https://", "").replace("http://", "")
            .replace("www.", "").split("/")[0].strip()
        )

    # ----------------------------------------------------------------------
    # PHASE 2: PARALLEL EXECUTION (Modules 2-6 run concurrently)
    # ----------------------------------------------------------------------
    print(f"\n  >> Phase 2: Parallel Execution for '{legal_name}'...")
    print(f"  >> Dispatching 5 specialist agents...")

    results = {
        "status":     {},
        "contacts":   {},
        "leadership": {},
        "financials": {},
        "signals":    {},
        "documents":  {},
    }

    def run_module(label, fn, *args):
        try:
            return label, fn(*args)
        except Exception as e:
            print(f"  WARN  Module {label} error: {e}")
            return label, {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(run_module, "status",     audit_status,     legal_name, ground_stat, ground_expl, search_url),
            executor.submit(run_module, "contacts",   audit_contacts,   legal_name, domain_only),
            executor.submit(run_module, "leadership", audit_leadership, legal_name),
            executor.submit(run_module, "financials", audit_financials, legal_name),
            executor.submit(run_module, "signals",    audit_signals,    legal_name, domain_only),
            executor.submit(run_module, "documents",  audit_documents,  legal_name, domain_only),
        }

        for future in concurrent.futures.as_completed(futures, timeout=240):
            try:
                label, data = future.result()
                results[label] = data or {}
            except Exception as e:
                print(f"  WARN  Future error: {e}")

    # ----------------------------------------------------------------------
    # PHASE 3: ASSEMBLY — Schema-Aligned Field Mapping
    # ----------------------------------------------------------------------
    print("\n  >> Phase 3: Assembling results...")

    now = datetime.now(timezone.utc)
    status_data     = results["status"]
    contact_data    = results["contacts"]
    leadership_data = results["leadership"]
    financial_data  = results["financials"]
    signal_data     = results["signals"]
    document_data   = results["documents"]

    update = {
        # -- Parameter 1: Identity & Scope --------------------------------
        "name":               identity.get("name"),
        "domain":             identity.get("domain"),
        "sepcStrategicDomain": identity.get("sepcStrategicDomain"),
        "subCategory":        identity.get("subCategory"),
        "isSepcRelevant":     identity.get("isSepcRelevant"),
        "description":        identity.get("description"),

        # -- Parameter 2: Status & Health ---------------------------------
        "isActive":           status_data.get("isActive"),
        "statusMessage":      status_data.get("statusMessage"),
        "websiteStatus":      status_data.get("websiteStatus"),
        "enrichedAt":         status_data.get("enrichedAt", now),
        "freshnessScore":     status_data.get("freshnessScore", 100),

        # -- Parameter 3: Contact & Location ------------------------------
        "officialEmail":        contact_data.get("officialEmail"),
        "phones":               contact_data.get("phones", []),
        "linkedinUrl":          contact_data.get("linkedinUrl"),
        "headquartersAddress":  contact_data.get("headquartersAddress"),
        "city":                 contact_data.get("city"),
        "country":              contact_data.get("country"),

        # -- Parameter 4: Leadership ---------------------------------------
        "currentCeo":     leadership_data.get("currentCeo"),
        "ceoLinkedinUrl": leadership_data.get("ceoLinkedinUrl"),
        "foundedBy":      leadership_data.get("foundedBy"),
        "foundedYear":    leadership_data.get("foundedYear"),
        "leadership":     leadership_data.get("leadership", []),
        "persons":        leadership_data.get("persons", []),

        # -- Parameter 5: Financial Intelligence --------------------------
        "revenue":           financial_data.get("revenue"),
        "stockInfo":         financial_data.get("stockInfo"),
        "tier":              financial_data.get("tier"),
        "tierJustification": financial_data.get("tierJustification"),
        "financialSignals":  financial_data.get("financialSignals", {}),

        # -- Parameter 6: Deep Intel & Signals ----------------------------
        "recentNews":    signal_data.get("recentNews", []),
        "riskLevel":     signal_data.get("riskLevel", "none"),
        "riskFlags":     signal_data.get("riskFlags", []),
        "activeSignals": signal_data.get("activeSignals", {}),

        # -- Parameter 7: Documents & Reports -----------------------------
        "documents":     document_data if isinstance(document_data, list) else [],

        # -- Meta ----------------------------------------------------------
        "enrichmentStatus": "full",
        "dataSource":       "IntelSync AI v11.0 (Modular)",
    }

    # Explicitly overwrite all DB data (even if None) to prevent stale state bleed
    update_clean = update

    # -- Save to MongoDB ----------------------------------------------------
    collection.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": update_clean}
    )

    elapsed = time.time() - start_time
    print(f"\n{'='*65}")
    print(f"  SUCCESS: '{legal_name}' fully audited in {elapsed:.1f}s")
    print(f"  Fields written: {len(update_clean)}")
    print(f"{'='*65}\n")

    mongo_client.close()
    return update_clean


# ==========================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IntelSync AI — Company Enrichment v10.0")
    parser.add_argument("--name",       required=True, help="Company name")
    parser.add_argument("--company_id", required=True, help="MongoDB ObjectId")
    parser.add_argument("--website",    default="",   help="Optional known website URL")
    args = parser.parse_args()

    enrich_and_save(args.name, args.company_id, args.website)
