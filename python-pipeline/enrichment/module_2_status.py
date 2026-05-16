"""
module_2_status.py — PARAMETER 2: Status & Health
===================================================
Responsible for ALL status and health fields:
  • isActive        — Boolean: is the company currently operational?
  • statusMessage   — Human-readable "why" behind the status
  • websiteStatus   — Technical health: active | protected | dead | error | no_url
  • freshnessScore  — 0-100% audit recency score
  • enrichedAt      — UTC datetime of this audit run
"""

import time
import requests
import concurrent.futures
from datetime import datetime, timezone
from ddgs import DDGS
from enrichment.llm_client import _llm, _parse_json

FRESHNESS_BANDS = [(1,100),(7,90),(14,75),(30,60),(60,40),(90,20),(180,10)]

CLOSURE_KEYWORDS = [
    "bankrupt","bankruptcy","dissolved","liquidated","shut down","shutdown",
    "closed down","ceases operations","wound up","nclt","insolvency",
    "acquired by","merged with","taken over by","no longer operating",
    "company closed","operations ceased",
]

def _ddgs_search(query, max_results=4):
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results))
    except Exception:
        return []

def check_website_health(url):
    """HTTP probe — returns isActive, websiteStatus, httpCode."""
    if not url:
        return {"isActive": None, "websiteStatus": "no_url", "httpCode": None}
    if not url.startswith("http"):
        url = "https://" + url
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SEPC-Audit/9.1"}
    try:
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        code = resp.status_code
        if code in (200,201,301,302,307,308):
            return {"isActive": True,  "websiteStatus": "active",    "httpCode": code}
        if code in (401,403,405,429):
            return {"isActive": True,  "websiteStatus": "protected", "httpCode": code}
        if code in (404,410,451):
            return {"isActive": False, "websiteStatus": "dead",      "httpCode": code}
        return {"isActive": None, "websiteStatus": f"http_{code}", "httpCode": code}
    except requests.exceptions.ConnectionError:
        return {"isActive": False, "websiteStatus": "unreachable",  "httpCode": None}
    except requests.exceptions.Timeout:
        return {"isActive": None,  "websiteStatus": "timeout",      "httpCode": None}
    except Exception:
        return {"isActive": None,  "websiteStatus": "error",        "httpCode": None}

def _search_closure_signals(legal_name):
    snippets = []
    queries = [
        f'"{legal_name}" acquired OR merged OR shutdown OR closed OR bankrupt 2023 2024 2025',
        f'"{legal_name}" company status operational dissolved liquidated',
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = {executor.submit(_ddgs_search, q, 4): q for q in queries}
        for future in concurrent.futures.as_completed(futures):
            try:
                results = future.result()
                for r in results:
                    snippets.append(f"{r.get('title','')} {r.get('body','')}"[:300])
            except Exception:
                pass
    return snippets

def _count_closure_signals(snippets):
    combined = " ".join(snippets).lower()
    found = [kw for kw in CLOSURE_KEYWORDS if kw in combined]
    return len(found), found

def _synthesize_status_message(legal_name, ground_status, ground_explanation, http_result, snippets):
    prompt = f"""Corporate intelligence analyst. Status of "{legal_name}":

SIGNALS:
- Ground Research: {ground_status} — "{ground_explanation}"
- Website HTTP: {http_result.get('websiteStatus')} (code {http_result.get('httpCode','N/A')})
- Search Snippets:
{chr(10).join(snippets[:6])[:2500]}

Write ONE factual status message (max 20 words) explaining why active/inactive.
Good examples:
- "Operating normally — website active, no closure signals found."
- "Acquired by Infosys Limited in March 2023."
- "Operations ceased 2024 — filed NCLT insolvency."

Return ONLY JSON:
{{"statusMessage":"message","isActive":true,"confidence":"high|medium|low"}}"""

    return _parse_json(_llm(prompt)) or {}

def calculate_freshness(enriched_at):
    """Returns 0-100 score based on audit recency."""
    if not enriched_at: return 0
    if isinstance(enriched_at, str): enriched_at = datetime.fromisoformat(enriched_at)
    if enriched_at.tzinfo is None: enriched_at = enriched_at.replace(tzinfo=timezone.utc)
    days_old = (datetime.now(timezone.utc) - enriched_at).days
    for threshold, score in FRESHNESS_BANDS:
        if days_old <= threshold: return score
    return 5

def audit_status(legal_name, ground_status, ground_explanation, search_url):
    """
    Main entry point for Module 2.
    Runs HTTP probe + closure search + LLM synthesis.
    Returns complete status & health dict.
    """
    print(f"    [M2] Auditing status & health for: {legal_name}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_http = executor.submit(check_website_health, search_url)
        f_closure = executor.submit(_search_closure_signals, legal_name)
        
        http_result = f_http.result()
        closure_snippets = f_closure.result()

    print(f"    [M2] HTTP: {http_result['websiteStatus']} (code: {http_result.get('httpCode')})")
    signal_count, _ = _count_closure_signals(closure_snippets)

    forced_inactive = ground_status in ("acquired", "defunct")
    llm_status = _synthesize_status_message(
        legal_name, ground_status, ground_explanation, http_result, closure_snippets
    )

    # Multi-signal isActive decision
    if forced_inactive:
        is_active = False
    elif llm_status.get("confidence") == "high" and llm_status.get("isActive") is not None:
        is_active = llm_status["isActive"]
    elif http_result["isActive"] is not None:
        is_active = False if (http_result["isActive"] and signal_count >= 3) else http_result["isActive"]
    else:
        is_active = None

    status_message = (
        llm_status.get("statusMessage")
        or ground_explanation
        or f"Website: {http_result['websiteStatus']}"
    )

    now = datetime.now(timezone.utc)
    print(f"    [M2] isActive={is_active} | {status_message[:60]}")
    return {
        "isActive": is_active,
        "statusMessage": status_message,
        "websiteStatus": http_result["websiteStatus"],
        "enrichedAt": now,
        "freshnessScore": 100,
    }
