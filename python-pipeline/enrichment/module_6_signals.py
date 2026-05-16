"""
module_6_signals.py — PARAMETER 6: Deep Intel & Signals v2.0
=============================================================
Responsible for ALL deep intel and signal fields:
  • recentNews      — 15 news items [{title, source, url, publishedAt, description, newsCategory}]
  • relatedReports  — Annual reports / financial PDFs [{title, url}]
  • riskLevel       — none | low | medium | high | critical
  • riskFlags       — Specific risk flags e.g. ['layoffs', 'lawsuit', 'bankruptcy']
  • activeSignals   — Object with signal summary for dashboard display

Risk uses MULTI-SIGNAL weighted scoring:
  - Each risk TYPE requires >= 2 keyword matches to be flagged (prevents single-word false positives)
  - High-weight flags (bankruptcy=4, shutdown=4) need only 1 match due to severity
  - Risk level escalates by total score: none=0, low=1, medium=3, high=6, critical=10
  - LLM sanity check for ambiguous scores (2-5)

Fixes v2.0:
  - Removed "trade" category (not in MongoDB enum) → folded into "expansion"
  - DDGS retry logic with backoff in news fetch
  - Proxy/redirect URL detection and cleanup
  - Tighter related-reports filter (document-only, not news articles)
  - Risk corpus threshold raised to 500 chars
  - Fragile source extraction fixed using urllib.parse
  - Rate limit sleep raised to 0.3s
  - LLM sanity-check "confirmed" field strictly validated as boolean True
"""

import re
import time
import concurrent.futures
from urllib.parse import urlparse
from ddgs import DDGS
from enrichment.llm_client import _llm, _parse_json


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# newsCategory must match MongoDB schema enum EXACTLY:
# ['financial', 'leadership', 'risk', 'expansion', 'product', 'general']
NEWS_CATEGORY_MAP = {
    "financial":  ["revenue", "profit", "earnings", "quarterly", "ipo", "stock", "fiscal",
                   "turnover", "revenue growth", "net profit", "net loss", "market cap", "valuation"],
    "risk":       ["bankrupt", "shutdown", "fraud", "penalty", "nclt", "scam", "lawsuit",
                   "layoffs", "breach", "fine", "violation", "complaint",
                   "defaulted", "insolvency", "arrested", "probe"],
    "leadership": ["ceo", "managing director", "appointed", "resigns", "resignation", "chairman",
                   "new ceo", "leadership change", "steps down", "takes charge", "board", "md "],
    "expansion":  ["expands", "expansion", "launch", "launches", "merger", "acquires", "acquired",
                   "partnership", "new market", "new office", "global", "international", "funding",
                   # Trade signals folded into expansion (was a separate invalid "trade" category)
                   "deal", "mou", "agreement", "contract", "export", "import", "procurement",
                   "global trade", "partnership deal", "signed", "tender", "order"],
    "product":    ["product launch", "new product", "feature", "platform", "app launch",
                   "solution", "service launch", "technology", "innovation"],
    # "general" is the fallback — no keywords needed
}

RISK_SIGNALS = {
    "bankruptcy":     ["bankrupt", "bankruptcy", "insolvency", "insolvent", "nclt", "liquidation"],
    "layoffs":        ["layoffs", "laid off", "job cuts", "workforce reduction", "retrenchment", "downsizing"],
    "lawsuit":        ["lawsuit", "sued", "litigation", "legal action", "court case", "fir filed", "complaint"],
    "fraud":          ["fraud", "scam", "ponzi", "misappropriation", "embezzlement", "cheating"],
    "shutdown":       ["shutdown", "closed", "shut down", "ceased operations", "closed down"],
    "fine":           ["penalty", "fine", "fined", "sanction", "penalized"],
    "leadership_risk":["ceo fired", "ceo arrested", "founder arrested", "md arrested"],
}

# Minimum keyword matches needed to trigger a flag per signal type.
# High-severity signals (bankruptcy, shutdown, fraud) fire on 1 match.
# Lower-severity signals need 2+ to avoid false positives from passing mentions.
RISK_MIN_MATCHES = {
    "bankruptcy": 1, "shutdown": 1, "fraud": 1, "leadership_risk": 1,
    "layoffs": 2, "lawsuit": 2, "fine": 2,
}

RISK_WEIGHTS = {
    "bankruptcy": 4, "shutdown": 4, "fraud": 3,
    "lawsuit": 2, "layoffs": 2, "fine": 1, "leadership_risk": 3,
}

RISK_THRESHOLDS = [
    (0,  "none"),
    (1,  "low"),
    (3,  "medium"),
    (6,  "high"),
    (10, "critical"),
]

# DDGS proxy URL patterns to detect and skip
_DDGS_REDIRECT_PATTERNS = [
    "duckduckgo.com/l/",
    "duckduckgo.com/y.js",
    "/l/?uddg=",
]


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
            print(f"    [M6] DDGS attempt {attempt+1} failed: {e}. Retrying in {wait}s...")
            time.sleep(wait)
    return []


def _is_redirect_url(url):
    """Returns True if the URL is a DDGS proxy/redirect wrapper (not a real link)."""
    if not url:
        return True
    return any(pattern in url for pattern in _DDGS_REDIRECT_PATTERNS)


def _clean_url(url):
    """
    Returns None if the URL is a DDGS redirect or obviously invalid.
    Otherwise returns the URL as-is (already resolved by DDGS in most cases).
    """
    if not url or _is_redirect_url(url):
        return None
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return None
        return url
    except Exception:
        return None


def _extract_source(url):
    """Safely extracts domain name from a URL as the source label."""
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        netloc = parsed.netloc or ""
        # Strip www. prefix
        return netloc.removeprefix("www.")
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# News Categorization
# ---------------------------------------------------------------------------

def _categorize_news_item(title, description="", source=""):
    """
    Categorizes a news item using the category keyword map.
    Returns the best matching MongoDB-valid category or 'general'.
    Categories: financial | leadership | risk | expansion | product | general
    """
    text = (title + " " + description + " " + source).lower()
    scores = {}
    for category, keywords in NEWS_CATEGORY_MAP.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[category] = score
    if not scores:
        return "general"
    best = max(scores, key=scores.get)
    # Final guard: ensure category is always in the valid enum set
    valid_categories = {"financial", "leadership", "risk", "expansion", "product", "general"}
    return best if best in valid_categories else "general"


# ---------------------------------------------------------------------------
# News Fetching
# ---------------------------------------------------------------------------

def _is_company_news(title, description, legal_name):
    """
    Ensures the news item is strictly about the requested company.
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
        
    text = (title + " " + description).lower()
    
    # Require the exact core name (first 2 words) to be present as a continuous phrase
    core_phrase = " ".join(name_tokens[:2])
    if core_phrase and core_phrase in text:
        return True
        
    return False


def _fetch_news(legal_name):
    """
    Fetches recent news using DDGS .news() with .text() fallback.
    - Retries news() up to 3 times on failure
    - Skips DDGS redirect/proxy URLs
    - Extracts source domain safely
    - Returns deduplicated list of news item dicts
    """
    news_items = []
    seen_titles = set()

    # Primary: DDGS News feed (with retry)
    for attempt in range(3):
        try:
            with DDGS() as ddgs:
                raw_news = list(ddgs.news(f'"{legal_name}"', max_results=15))
            for r in raw_news:
                title = (r.get("title") or "").strip()
                url = _clean_url(r.get("url") or r.get("href") or "")
                if not title or title.lower() in seen_titles:
                    continue
                if not url:
                    continue  # Skip items with no valid URL
                seen_titles.add(title.lower())
                desc = (r.get("body") or r.get("excerpt") or "")[:300]
                if not _is_company_news(title, desc, legal_name):
                    continue

                news_items.append({
                    "title":        title,
                    "source":       r.get("source") or _extract_source(url),
                    "url":          url,
                    "publishedAt":  r.get("date", ""),
                    "description":  desc,
                    "newsCategory": _categorize_news_item(title, desc, r.get("source", "")),
                })
            break  # Success — exit retry loop
        except Exception as e:
            wait = 0.2 * (attempt + 1)
            print(f"    [M6] News fetch attempt {attempt+1} failed: {e}. Retrying in {wait}s...")
            time.sleep(wait)

    print(f"    [M6] Primary news: {len(news_items)} items")

    # Fallback: DDGS text search (fires if primary got < 5 good items)
    if len(news_items) < 5:
        fallback_queries = [
            f'"{legal_name}" news 2025',
            f'"{legal_name}" latest update announcement 2024 2025',
            f'"{legal_name}" press release statement 2024 2025',
        ]
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(_ddgs_search, q, 6): q for q in fallback_queries}
            for future in concurrent.futures.as_completed(futures):
                try:
                    results = future.result()
                    for r in results:
                        title = (r.get("title") or "").strip()
                        url = _clean_url(r.get("href") or "")
                        if not title or not url or title.lower() in seen_titles:
                            continue
                        seen_titles.add(title.lower())
                        desc = (r.get("body") or "")[:300]
                        if not _is_company_news(title, desc, legal_name):
                            continue

                        news_items.append({
                            "title":        title,
                            "source":       _extract_source(url),
                            "url":          url,
                            "publishedAt":  "",
                            "description":  desc,
                            "newsCategory": _categorize_news_item(title, desc),
                        })
                except Exception:
                    pass

    return news_items[:15]


# ---------------------------------------------------------------------------
# NOTE: Document/report fetching has been moved to module_7_documents.py
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Risk Assessment
# ---------------------------------------------------------------------------

def _calculate_risk(legal_name, news_items, domain_only=""):
    """
    Multi-signal risk scoring.
    - Requires minimum keyword match count per signal type (see RISK_MIN_MATCHES)
    - Adds dedicated risk search if corpus is thin (< 500 chars)
    - LLM sanity-checks ambiguous scores (2-5), with strict boolean check on 'confirmed'
    Returns: riskLevel (str), riskFlags (list), activeSignals (dict)
    """
    # Build full text corpus from all news items
    corpus = " ".join(
        f"{item['title']} {item['description']}" for item in news_items
    ).lower()

    # Dedicated risk search if corpus is too thin to be meaningful
    if len(corpus) < 500:
        print(f"    [M6] Corpus thin ({len(corpus)} chars). Running dedicated risk search...")
        risk_results = _ddgs_search(
            f'"{legal_name}" layoffs OR bankrupt OR lawsuit OR fraud OR shutdown 2024 2025',
            max_results=8
        )
        for r in risk_results:
            corpus += f" {r.get('title', '')} {r.get('body', '')}".lower()
        print(f"    [M6] Corpus after risk search: {len(corpus)} chars")

    # Score each risk signal type
    triggered_flags = []
    total_score = 0
    signal_detail = {}

    for flag, keywords in RISK_SIGNALS.items():
        matches = [kw for kw in keywords if kw in corpus]
        min_required = RISK_MIN_MATCHES.get(flag, 1)
        if len(matches) >= min_required:
            triggered_flags.append(flag)
            weight = RISK_WEIGHTS.get(flag, 1)
            total_score += weight
            signal_detail[flag] = matches[:3]

    # Determine risk level from total score
    risk_level = "none"
    for threshold, level in RISK_THRESHOLDS:
        if total_score >= threshold:
            risk_level = level

    # LLM sanity check for ambiguous scores (2-5)
    if 2 <= total_score <= 5 and len(corpus) > 300:
        llm_context = corpus[:3000]
        prompt = f"""Risk assessment for "{legal_name}". Evidence corpus: {llm_context}

Triggered signals: {triggered_flags}. Weighted score: {total_score}.

Evaluate carefully: Are these risk signals genuinely about "{legal_name}" itself,
or are they about other companies/people mentioned in the same articles?
If signals clearly apply to this company → confirmed: true.
If signals are about others, or are clearly historical/resolved → confirmed: false.

Return ONLY valid JSON (no markdown):
{{"riskLevel": "none|low|medium|high|critical", "confirmed": true}}
or
{{"riskLevel": "none", "confirmed": false}}"""

        llm_result = _parse_json(_llm(prompt)) or {}
        # Strictly check boolean True — string "true"/"false" must not pass
        if llm_result.get("confirmed") is True and llm_result.get("riskLevel") in \
                {"none", "low", "medium", "high", "critical"}:
            risk_level = llm_result["riskLevel"]

    active_signals = {
        "riskScore":    total_score,
        "signalDetail": signal_detail,
        "newsCount":    len(news_items),
    }

    return risk_level, triggered_flags, active_signals


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def audit_signals(legal_name, domain_only=""):
    """
    Main entry point for Module 6.
    Fetches news (with retry + URL validation) and calculates multi-signal risk assessment.
    Document/report fetching is handled exclusively by Module 7 (module_7_documents.py).
    """
    print(f"    [M6] Gathering deep intel & signals for: {legal_name}")

    # Step 1: Fetch recent news (primary + fallback, with URL cleanup)
    news_items = _fetch_news(legal_name)
    print(f"    [M6] News items (valid URLs): {len(news_items)}")

    # Step 2: Multi-signal risk assessment
    risk_level, risk_flags, active_signals = _calculate_risk(legal_name, news_items, domain_only)
    print(f"    [M6] Risk: {risk_level} | Flags: {risk_flags}")

    return {
        "recentNews":    news_items,
        "riskLevel":     risk_level,
        "riskFlags":     risk_flags,
        "activeSignals": active_signals,
    }
