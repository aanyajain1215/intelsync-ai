"""
module_7_documents.py — PARAMETER 7: Company Documents & Reports
=================================================================
Dedicated document intelligence agent. Finds all publicly available
documents, PDFs, filings and reports for a company from the web.

Fetches:
  • Annual Reports (BSE, NSE, company website)
  • Audit & Statutory Reports
  • Financial Statements / Balance Sheets
  • SEBI / MCA / Regulatory Filings
  • Investor Presentations
  • Credit Rating Reports (CRISIL, ICRA, CARE)
  • Sustainability / ESG Reports
  • IPO Prospectus / DRHP

Output (schema-aligned):
  documents: [
    {
      title:   "TCS Annual Report FY2024",
      url:     "https://...",         ← direct link, verified working
      docType: "annual_report",       ← classified type
      year:    "2024",                ← extracted from title/URL
      verified: True                  ← HEAD-checked URL
    }
  ]

All returned URLs are:
  - Direct links (not DDGS redirect wrappers)
  - HEAD-verified (HTTP 200/301/302)
  - Confirmed to belong to the company (name token check)
"""

import re
import time
import requests
import concurrent.futures
from urllib.parse import urlparse
from ddgs import DDGS
from enrichment.llm_client import _llm, _parse_json


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DOC_TYPE_KEYWORDS = {
    "annual_report":          ["annual report", "annual-report", "annualreport",
                               "yearly report", "annual return"],
    "audit":                  ["audit report", "auditor report", "statutory audit",
                               "internal audit", "auditors report"],
    "financial_statement":    ["financial statement", "balance sheet", "profit and loss",
                               "income statement", "cash flow statement", "financial results"],
    "regulatory_filing":      ["sebi filing", "mca filing", "roc filing", "form mgt",
                               "annual return", "nse filing", "bse filing", "nclt"],
    "investor_presentation":  ["investor presentation", "corporate presentation",
                               "investor day", "analyst presentation", "earnings presentation"],
    "credit_rating":          ["credit rating", "crisil", "icra", "care rating",
                               "rating report", "rating rationale"],
    "prospectus":             ["prospectus", "drhp", "red herring prospectus",
                               "ipo document", "offer document"],
    "sustainability":         ["sustainability report", "esg report", "csr report",
                               "environmental report", "social responsibility"],
}

# Valid years we care about (2015–2025)
YEAR_PATTERN = re.compile(r'20(1[5-9]|2[0-5])')

# DDGS proxy patterns to skip
REDIRECT_PATTERNS = ["duckduckgo.com/l/", "/l/?uddg=", "duckduckgo.com/y.js"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ddgs_search(query, max_results=6, retries=3):
    """DDGS text search with retry/backoff."""
    for attempt in range(retries):
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                if results:
                    return results
        except Exception as e:
            wait = 0.2 * (attempt + 1)
            print(f"    [M7] DDGS attempt {attempt+1} failed: {e}. Retry in {wait}s...")
            time.sleep(wait)
    return []


def _is_redirect(url):
    """Detects DDGS proxy/redirect wrapper URLs."""
    return any(p in url for p in REDIRECT_PATTERNS)


def _verify_url(url, timeout=8):
    """
    HEAD-requests the URL to confirm it's alive and accessible.
    Returns True if HTTP 200/301/302/307/308.
    """
    try:
        resp = requests.head(
            url, timeout=timeout, allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (SEPC-DocBot/1.0)"}
        )
        return resp.status_code in (200, 201, 301, 302, 307, 308)
    except Exception:
        return False


def _classify_doc_type(title, url):
    """
    Classifies the document type based on title and URL keywords.
    Returns the most specific matching type or 'other'.
    """
    text = (title + " " + url).lower()
    for doc_type, keywords in DOC_TYPE_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return doc_type
    # Fallback: if URL ends in .pdf but nothing specific matched
    if url.lower().endswith(".pdf"):
        return "other"
    return None  # Not a document at all


def _extract_year(title, url):
    """Extracts the most recent year found in title or URL string."""
    text = title + " " + url
    matches = YEAR_PATTERN.findall(text)
    if matches:
        # Return full year from the suffix matched (e.g., "24" → "2024")
        years = ["20" + m for m in matches]
        return max(years)  # Most recent year
    return None


def _is_company_document(title, legal_name):
    """
    Ensures the document is strictly about the requested company.
    Extracts the core brand identity and verifies its presence.
    """
    stop_words = {"limited", "ltd", "pvt", "private", "inc", "llp", "llc",
                  "corp", "corporation", "the", "and", "&", "of", "for",
                  "company", "technologies", "services", "solutions", "group",
                  "india", "global", "enterprises", "industries"}
    
    name_tokens = [
        t.lower() for t in legal_name.replace(',', '').replace('.', '').split()
        if len(t) > 2 and t.lower() not in stop_words
    ]
    
    if not name_tokens:
        return True  # Name was entirely generic, can't filter safely
        
    text = title.lower()
    
    # RELAXED LOCK: Require at least one significant token from the company name to be in the title.
    # This avoids rejecting "Health & Harmony" if we are looking for "Health Harmony".
    # The LLM pass later will handle the final precision.
    for token in name_tokens:
        if token in text:
            return True
            
    return False


def _clean_url(url):
    """Returns None if URL is a redirect or malformed."""
    if not url or _is_redirect(url):
        return None
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return None
        return url
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Search Streams
# ---------------------------------------------------------------------------

def _run_document_searches(legal_name, domain_only=""):
    """
    Runs 12 targeted document search streams covering all major document types.
    Returns raw list of (title, url) tuples before verification.
    """
    queries = [
        # Annual Reports
        f'"{legal_name}" annual report 2024 2025 filetype:pdf',
        f'"{legal_name}" annual report site:bseindia.com OR site:nseindia.com',
        f'"{legal_name}" annual report site:sebi.gov.in OR site:mca.gov.in',

        # Financial Statements & Audits
        f'"{legal_name}" financial statement balance sheet filetype:pdf 2024',
        f'"{legal_name}" audit report statutory auditor 2024 filetype:pdf',

        # Regulatory Filings
        f'"{legal_name}" SEBI filing OR MCA filing OR ROC annual return',
        f'site:bseindia.com "{legal_name}" results OR annual',

        # Investor Presentations & Credit Ratings
        f'"{legal_name}" investor presentation corporate presentation filetype:pdf',
        f'"{legal_name}" CRISIL OR ICRA OR CARE rating report',

        # IPO & Prospectus
        f'"{legal_name}" DRHP OR prospectus OR "red herring" filetype:pdf',

        # Sustainability / ESG
        f'"{legal_name}" sustainability report ESG CSR 2024 filetype:pdf',
    ]

    # Site-specific search on company's own domain
    if domain_only:
        queries.append(f'site:{domain_only} annual report OR financial statement OR investor')

    raw_candidates = []
    seen_urls = set()

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(queries)) as executor:
        futures = {executor.submit(_ddgs_search, q, 10): q for q in queries}
        for future in concurrent.futures.as_completed(futures):
            try:
                results = future.result()
                for r in results:
                    url = _clean_url(r.get("href") or "")
                    title = (r.get("title") or "").strip()
                    if url and title and url not in seen_urls:
                        seen_urls.add(url)
                        raw_candidates.append((title, url))
            except Exception:
                pass

    print(f"    [M7] Raw candidates: {len(raw_candidates)}")
    return raw_candidates


# ---------------------------------------------------------------------------
# LLM disambiguation pass
# ---------------------------------------------------------------------------

def _llm_pick_best_docs(legal_name, candidates):
    """
    When there are many candidates, uses LLM to pick the most relevant ones
    and confirm they are about the specific company.
    Returns list of confirmed (title, url) tuples.
    """
    if len(candidates) <= 12:
        return candidates  # Small enough to process without LLM filter

    candidate_text = "\n".join(
        f"{i+1}. TITLE: {t} | URL: {u}"
        for i, (t, u) in enumerate(candidates[:30])
    )

    prompt = f"""You are a document analyst for "{legal_name}".
Below is a list of documents found on the web. Select ONLY those that are:
1. Genuinely about "{legal_name}" (not a different company)
2. An official document (annual report, audit, financial statement, regulatory filing, investor presentation, credit rating, prospectus, sustainability report)

CANDIDATES:
{candidate_text}

Return ONLY valid JSON array with selected item numbers:
{{"selected": [1, 3, 5, ...]}}"""

    result = _parse_json(_llm(prompt)) or {}
    selected_indices = result.get("selected", [])

    if not selected_indices:
        return candidates  # Fallback: return all

    confirmed = []
    for idx in selected_indices:
        if 1 <= idx <= len(candidates):
            confirmed.append(candidates[idx - 1])
    return confirmed if confirmed else candidates


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def audit_documents(legal_name, domain_only=""):
    """
    Main entry point for Module 7.
    Discovers all publicly available documents for the company, verifies URLs,
    classifies document types, and returns a clean structured list.

    Returns:
        List of dicts: [{title, url, docType, year, verified}]
    """
    print(f"    [M7] Discovering documents & reports for: {legal_name}")

    # Step 1: Run all document search streams
    raw_candidates = _run_document_searches(legal_name, domain_only)

    # Step 2: Filter by company name presence and doc type classification
    typed_candidates = []
    for title, url in raw_candidates:
        doc_type = _classify_doc_type(title, url)
        if doc_type is None:
            continue  # Not a document — skip
        if not _is_company_document(title, legal_name):
            continue  # Not about this company — skip
        typed_candidates.append((title, url, doc_type))

    print(f"    [M7] After type/name filter: {len(typed_candidates)}")

    # Step 3: LLM disambiguation for large candidate sets
    llm_input = [(t, u) for t, u, _ in typed_candidates]
    confirmed_pairs = _llm_pick_best_docs(legal_name, llm_input)
    confirmed_urls = {u for _, u in confirmed_pairs}

    # Step 4: Build candidate set with metadata, then verify URLs in parallel
    documents = []
    seen_urls = set()

    def verify_and_build(item):
        title, url, doc_type = item
        if url not in confirmed_urls:
            return None
        
        year = _extract_year(title, url)
        if _verify_url(url):
            return {
                "title":    title,
                "url":      url,
                "docType":  doc_type,
                "year":     year,
                "verified": True,
            }
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(verify_and_build, typed_candidates))
        for doc in results:
            if doc and doc["url"] not in seen_urls:
                seen_urls.add(doc["url"])
                documents.append(doc)

    # Sort: most recent first, then by type priority
    TYPE_PRIORITY = {
        "annual_report": 0, "financial_statement": 1, "audit": 2,
        "regulatory_filing": 3, "investor_presentation": 4,
        "credit_rating": 5, "prospectus": 6, "sustainability": 7, "other": 8
    }
    documents.sort(key=lambda d: (
        -(int(d["year"]) if d["year"] else 0),
        TYPE_PRIORITY.get(d["docType"], 99)
    ))

    print(f"    [M7] Verified documents: {len(documents)}")
    return documents[:20]  # Cap at 20 documents
