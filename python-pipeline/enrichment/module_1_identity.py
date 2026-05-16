"""
module_1_identity.py — PARAMETER 1: Identity & Scope
=======================================================
Responsible for ALL identity and scope fields:
  • name             — Verified full legal name
  • domain           — High-level SEPC strategic pillar
  • subCategory      — Specific business type
  • sepcStrategicDomain — One of 6 core pillars or "None"
  • isSepcRelevant   — Boolean flag
  • description      — 3-4 sentence factual executive summary

Internal outputs (used by orchestrator, not saved):
  • _groundStatus    — active | acquired | defunct
  • _groundExplanation — Reason string
  • _searchUrl       — Resolved official website URL
"""

import re
import time
import concurrent.futures
from ddgs import DDGS
from enrichment.llm_client import _llm, _parse_json

# -- Constants --------------------------------------------------------------
SEPC_DOMAINS = [
    "Media and Entertainment",
    "Education",
    "Healthcare",
    "Tourism",
    "Financial services",
    "Consultancy services",
]

SUB_CATEGORIES = {
    "Media and Entertainment": ["Animation & VFX", "Film & Distribution", "Gaming & Esports",
                                "Digital Media & OTT", "Broadcasting & Television", "Music & Audio",
                                "Advertising & PR", "Publishing"],
    "Education":               ["K-12 Schools", "Higher Education", "EdTech Platforms",
                                "Research Institutes", "Skill Development", "Coaching & Tutorials",
                                "Corporate Training"],
    "Healthcare":              ["Hospitals & Clinics", "HealthTech", "Pharma & Biotech",
                                "Wellness & Ayurveda", "Medical Devices", "Mental Health",
                                "Diagnostic & Labs"],
    "Tourism":                 ["Hotels & Resorts", "Tour Operators", "Adventure Tourism",
                                "Eco & Heritage Tourism", "Spiritual Tourism", "Travel Tech",
                                "Airlines & Aviation"],
    "Financial services":      ["FinTech", "Banking & Forex", "Wealth Management",
                                "Insurance", "Payments & Wallets", "Accounting & Audit",
                                "Investment & Capital Markets"],
    "Consultancy services":    ["Management Consulting", "IT Consulting & BPO",
                                "Legal Advisory", "HR Consulting", "Strategy & Advisory",
                                "Digital Transformation", "Outsourcing / KPO"],
}


# -- Helper: run targeted DDGS search --------------------------------------
def _ddgs_search(query, max_results=4):
    """Returns a list of result dicts with title, href, body."""
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results))
    except Exception:
        return []


def _format_snippets(results):
    return "\n".join(
        f"TITLE: {r.get('title', '')} | URL: {r.get('href', '')} | SNIPPET: {r.get('body', '')[:300]}"
        for r in results
    )


# -- Phase A: Legal Name Grounding ------------------------------------------
def _ground_legal_identity(company_name, input_website=""):
    """
    Resolves the TRUE legal name, official URL, and operational status.
    Uses 4 search streams for maximum signal coverage.
    """
    queries = [
        f'site:linkedin.com/company "{company_name}"',
        f'"{company_name}" official website headquarters "about us"',
        f'"{company_name}" crunchbase OR wikipedia company profile',
        f'"{company_name}" acquired OR merged OR dissolved OR shutdown 2023 2024 2025',
    ]

    all_snippets = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        future_to_query = {executor.submit(_ddgs_search, q, 3): q for q in queries}
        for future in concurrent.futures.as_completed(future_to_query):
            try:
                results = future.result()
                all_snippets.extend(results)
            except Exception:
                pass

    snippet_text = _format_snippets(all_snippets)

    prompt = f"""You are a senior forensic corporate auditor. Determine the TRUE legal entity for: "{company_name}".

SEARCH EVIDENCE:
{snippet_text[:5000]}

INPUT WEBSITE (if provided): {input_website or "None"}

RULES:
1. LEGAL NAME: Use the full registered name (e.g., "Tata Consultancy Services Limited", not "TCS").
2. ACQUIRED: If evidence says "acquired by X" or "merged into Y", set status=acquired and note the parent.
3. DEFUNCT: If evidence says "shut down", "closed", "bankrupt", set status=defunct.
4. URL: Extract the most authoritative official website domain (prefer .com/.in over LinkedIn).
5. If no closure/acquisition is mentioned, set status=active.

Return ONLY valid JSON — no commentary:
{{
  "fullLegalName": "Full official registered name",
  "officialWebsite": "https://domain.com",
  "status": "active | acquired | defunct",
  "explanation": "One sentence reason (e.g., Acquired by Infosys in 2023)"
}}"""

    result = _parse_json(_llm(prompt)) or {}
    return {
        "fullLegalName": result.get("fullLegalName", company_name),
        "officialWebsite": result.get("officialWebsite") or input_website or "",
        "status": result.get("status", "active"),
        "explanation": result.get("explanation", ""),
    }


# -- Phase B: Domain Classification & Description ---------------------------
def _classify_and_describe(legal_name, official_url, ground_status):
    """
    Identifies the SEPC domain, sub-category, relevance flag, and description.
    Uses a dedicated set of discovery searches anchored to the verified legal name.
    """
    queries = [
        f'"{legal_name}" services offerings products industry sector',
        f'"{legal_name}" company overview history founded',
        f'"{legal_name}" {official_url} about us business',
    ]

    all_snippets = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        future_to_query = {executor.submit(_ddgs_search, q, 4): q for q in queries}
        for future in concurrent.futures.as_completed(future_to_query):
            try:
                results = future.result()
                all_snippets.extend(results)
            except Exception:
                pass

    snippet_text = _format_snippets(all_snippets)

    sepc_list = "\n".join(f"  {i+1}. {d}" for i, d in enumerate(SEPC_DOMAINS))

    prompt = f"""You are a senior SEPC Intelligence analyst classifying companies for India's Service Export Promotion Council.

COMPANY: "{legal_name}"
OFFICIAL WEBSITE: {official_url or "Unknown"}
OPERATIONAL STATUS: {ground_status}

SEARCH EVIDENCE:
{snippet_text[:6000]}

THE 6 SEPC STRATEGIC DOMAINS (service exports ONLY):
{sepc_list}

CLASSIFICATION RULES:
1. SEPC RELEVANT: Only service-export companies qualify (IT, consulting, media production, education platforms, 
   hospitals/healthcare, tourism operators, financial services). Pure product manufacturers = NOT relevant.
2. DOMAIN: Pick EXACTLY ONE from the 6 above. If none fit, use "None".
3. SUB-CATEGORY: A precise business-type label (e.g., "IT Services & BPO", "Animation Studio", "EdTech Platform").
4. DESCRIPTION: Write 3-4 factual sentences covering: what the company does, its scale/market position, 
   key service lines, and any notable clients or achievements. NO speculation — only evidence-based facts.
5. If status is "acquired" or "defunct", note this in the description.

Return ONLY valid JSON — no commentary:
{{
  "domain": "Exact SEPC domain or None",
  "sepcStrategicDomain": "Exact SEPC domain or None",
  "subCategory": "Precise business type",
  "isSepcRelevant": true or false,
  "description": "3-4 factual sentences about the company."
}}"""

    result = _parse_json(_llm(prompt)) or {}

    # Validate domain against allowed list
    domain = result.get("domain", "")
    if domain not in SEPC_DOMAINS:
        domain = None
        result["isSepcRelevant"] = False

    return {
        "domain": domain,
        "sepcStrategicDomain": domain,
        "subCategory": result.get("subCategory", "Unknown"),
        "isSepcRelevant": bool(result.get("isSepcRelevant", False)),
        "description": result.get("description", ""),
    }


# -- Public API -------------------------------------------------------------
def audit_identity(company_name, input_website=""):
    """
    Main entry point for Module 1.
    Returns a complete identity + scope dict plus internal metadata for the orchestrator.
    """
    print(f"    [M1] Grounding identity for: {company_name}")

    # Phase A: Resolve legal name, URL, and status
    grounding = _ground_legal_identity(company_name, input_website)
    legal_name = grounding["fullLegalName"]
    official_url = grounding["officialWebsite"]

    print(f"    [M1] OK Legal Name: {legal_name} | Status: {grounding['status']} | URL: {official_url}")

    # Phase B: Classify domain and build description
    scope = _classify_and_describe(legal_name, official_url, grounding["status"])

    print(f"    [M1] OK Domain: {scope['domain']} | Sub: {scope['subCategory']} | SEPC: {scope['isSepcRelevant']}")

    return {
        # -- Public fields saved to DB --
        "name": legal_name,
        "domain": scope["domain"],
        "sepcStrategicDomain": scope["sepcStrategicDomain"],
        "subCategory": scope["subCategory"],
        "isSepcRelevant": scope["isSepcRelevant"],
        "description": scope["description"],

        # -- Internal metadata for orchestrator --
        "_groundStatus": grounding["status"],
        "_groundExplanation": grounding["explanation"],
        "_searchUrl": official_url,
        "_legalName": legal_name,
    }
