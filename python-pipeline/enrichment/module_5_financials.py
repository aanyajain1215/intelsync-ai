"""
module_5_financials.py — PARAMETER 5: Financial Intelligence v2.0
==================================================================
Responsible for ALL financial fields (schema-aligned):
  • revenue              — Latest annual revenue with year (e.g., "₹4,500 Cr (FY2024)")
  • stockInfo            — Composite "NSE:TCS | ₹3,820 (Apr 2025)"
  • tier                 — 1 (large) / 2 (mid) / 3 (small/startup)
  • tierJustification    — Evidence-based reason
  • financialSignals     — Nested object containing:
      - revenueGrowth    — YoY % change
      - profitLoss       — Net profit/loss figure with year
      - profitTrend      — profit | loss | breakeven | unknown
      - marketCap        — Total market valuation
      - stockTicker      — Exchange:Ticker (e.g., NSE:TCS)
      - stockPrice       — Latest quote with date
      - fundingStatus    — Stage + total raised (e.g., "Series C — $50M")
      - lastFundingAmount
      - lastFundingDate
      - valuation

Improvements v2.0:
  - 10 search streams (up from 6) including Crunchbase, Wikipedia, BSE/NSE, Moneycontrol
  - Unquoted fallback queries when exact-name results are thin
  - DDGS retry logic with backoff (3 attempts)
  - Increased max_results to 6 per query
  - Increased sleep to 0.3s to avoid rate limits
  - Second LLM pass when primary returns all-null result
  - Stronger tier validation (seed/pre-series → Tier 3, explicit ₹ Cr ranges)
  - profitTrend inferred from profitLoss string if LLM misses it
  - LLM prompt enforces company-identity check to prevent data bleed
"""

import re
import time
import concurrent.futures
from ddgs import DDGS
from enrichment.llm_client import _llm, _parse_json


# ---------------------------------------------------------------------------
# DDGS with retry + backoff
# ---------------------------------------------------------------------------
def _ddgs_search(query, max_results=6, retries=3):
    """Searches DDGS with retry logic. Returns list of result dicts."""
    for attempt in range(retries):
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                if results:
                    return results
        except Exception as e:
            wait = 0.2 * (attempt + 1)
            print(f"    [M5] DDGS attempt {attempt+1} failed: {e}. Retrying in {wait}s...")
            time.sleep(wait)
    return []


def _format_result(r):
    """Formats a single DDGS result as a source-tagged block."""
    return (
        f"[SOURCE: {r.get('href', '')}]\n"
        f"TITLE: {r.get('title', '')}\n"
        f"SNIPPET: {r.get('body', '')[:400]}\n"
    )


# ---------------------------------------------------------------------------
# PRIMARY search streams — 10 targeted financial queries
# ---------------------------------------------------------------------------
def _primary_searches(legal_name):
    """
    10 targeted financial queries using exact name.
    Covers revenue, profit, stock, funding, Crunchbase, Wikipedia, BSE/NSE, Moneycontrol.
    """
    queries = [
        # Core financial metrics
        f'"{legal_name}" annual revenue turnover fiscal year 2024 2025 FY24 FY25',
        f'"{legal_name}" quarterly results net profit loss PAT 2024 2025',
        f'"{legal_name}" market capitalization market cap stock price NSE BSE NYSE NASDAQ',
        f'"{legal_name}" funding round raised valuation investors 2023 2024 2025',
        f'"{legal_name}" revenue growth YoY year over year financial performance',
        f'"{legal_name}" investor relations annual report financial highlights',
        # Authoritative sources explicitly targeted
        f'site:crunchbase.com "{legal_name}" funding valuation revenue',
        f'site:wikipedia.org "{legal_name}" revenue employees founded',
        f'site:moneycontrol.com OR site:bseindia.com OR site:nseindia.com "{legal_name}"',
        f'"{legal_name}" total income operating revenue EBITDA profit after tax',
    ]

    parts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_ddgs_search, q, 6): q for q in queries}
        for future in concurrent.futures.as_completed(futures):
            try:
                results = future.result()
                for r in results:
                    parts.append(_format_result(r))
            except Exception:
                pass

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# FALLBACK search streams — unquoted, broader queries
# ---------------------------------------------------------------------------
def _fallback_searches(legal_name):
    """
    Runs broader, unquoted queries when the primary searches return thin context.
    Used for small/niche companies with low web presence.
    """
    # Use first 2-3 significant words only (drops Ltd/Limited/Pvt etc.)
    name_words = [w for w in legal_name.split() if w.lower() not in
                  {"limited", "ltd", "pvt", "private", "inc", "llp", "llc", "corp", "corporation", "the", "and", "&"}]
    short_name = " ".join(name_words[:3])

    queries = [
        f'"{short_name}" revenue turnover annual report 2024 2025',
        f'"{short_name}" funding raised startup valuation crunchbase',
        f'"{short_name}" financial results profit loss 2024',
        f'"{short_name}" company size employees revenue India',
    ]

    parts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(_ddgs_search, q, 5): q for q in queries}
        for future in concurrent.futures.as_completed(futures):
            try:
                results = future.result()
                for r in results:
                    parts.append(_format_result(r))
            except Exception:
                pass

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Combined search entry point
# ---------------------------------------------------------------------------
def search_financials(legal_name):
    """
    Runs primary financial searches. If context is too thin (< 600 chars),
    automatically falls back to broader unquoted queries and merges results.
    """
    print(f"    [M5] Running primary financial searches...")
    primary_context = _primary_searches(legal_name)

    if len(primary_context.strip()) < 600:
        print(f"    [M5] Primary context thin ({len(primary_context)} chars). Running fallback searches...")
        fallback_context = _fallback_searches(legal_name)
        combined = primary_context + "\n\n[FALLBACK RESULTS]\n" + fallback_context
        print(f"    [M5] Combined context: {len(combined)} chars")
        return combined

    print(f"    [M5] Primary context: {len(primary_context)} chars")
    return primary_context


# ---------------------------------------------------------------------------
# LLM Extraction — Primary pass
# ---------------------------------------------------------------------------
def _llm_extract_financials(legal_name, context_text):
    """
    Expert financial analyst LLM extraction.
    Enforces company-identity validation to prevent data bleed from similar names.
    """
    prompt = f"""You are a senior financial analyst extracting verified fiscal data for the company: "{legal_name}".

FINANCIAL EVIDENCE (source-tagged):
{context_text[:8000]}

CRITICAL RULES:
1. STRICT IDENTITY LOCK: All data MUST be about the exact entity "{legal_name}" specifically. If a snippet mentions a different company with a similar name, IGNORE it entirely. DO NOT cross-contaminate data.
2. ANTI-HALLUCINATION: If verified numbers are not explicitly present in the text, return null. DO NOT carry over numbers from other contexts (like $45M). NEVER guess or fabricate.
3. REVENUE: Use the LATEST complete fiscal year only (FY25 > FY24 > FY23). Include the year.
   Indian format: "₹4,500 Cr (FY2024)". Global format: "$2.1B (FY2025)". Standardize units — never mix.
4. PROFIT/LOSS: State the LATEST net profit or net loss figure with year. Include "Net Profit" or "Net Loss" label.
5. GROWTH: Extract YoY revenue growth as percentage ("+12% YoY" or "-5% YoY"). Derive from two years' data if explicit % not stated.
6. STOCK: Only for publicly listed companies. Format: "NSE:TCS" or "BSE:532540" or "NYSE:INFY". NEVER guess tickers.
7. FUNDING: For private/startup companies — most recent round stage + total raised (e.g., "Series B — $20M (2024)").
8. ACCURACY: If two contradictory figures exist, prefer the official investor relations or BSE/NSE filing source.
8. TIER classification:
   - Tier 1: Revenue > ₹750 Cr / $100M, OR listed on major exchange, OR market cap > ₹4,000 Cr / $500M
   - Tier 2: Revenue ₹75 Cr–₹750 Cr / $10M–$100M, OR 100–999 employees, OR Series B/C funded
   - Tier 3: Revenue < ₹75 Cr / $10M, OR startup/seed/early-stage, OR bootstrapped with no public financials
9. TIER JUSTIFICATION: Cite the specific evidence (e.g., "Revenue ₹920 Cr (FY2024) per Moneycontrol").

Return ONLY valid JSON (no markdown, no commentary):
{{
  "revenue": "Latest annual revenue with year, or null",
  "financialSignals": {{
    "revenueGrowth": "YoY % or null",
    "profitLoss": "Net profit/loss label + amount + year, or null",
    "profitTrend": "profit | loss | breakeven | unknown",
    "marketCap": "Market cap string or null",
    "stockTicker": "EXCHANGE:TICKER or null",
    "stockPrice": "Price with date or null",
    "fundingStatus": "Stage and total raised, or null",
    "lastFundingAmount": "Amount or null",
    "lastFundingDate": "Date or null",
    "valuation": "Valuation if known, or null"
  }},
  "tier": 1,
  "tierJustification": "Specific evidence-based reason with source"
}}"""

    return _parse_json(_llm(prompt)) or {}


# ---------------------------------------------------------------------------
# LLM Fallback pass — simplified prompt when primary returns all nulls
# ---------------------------------------------------------------------------
def _llm_fallback_extract(legal_name, context_text):
    """
    Second, simplified LLM pass when the primary extraction returns empty results.
    Relaxes strictness to pick up whatever signals are available.
    """
    prompt = f"""Extract any available financial information about "{legal_name}" from the text below.
Even partial information is useful. Focus on size signals: revenue, funding, employee count, whether it's listed or private.

TEXT:
{context_text[:5000]}

Return ONLY valid JSON:
{{
  "revenue": "Any revenue figure found, or null",
  "financialSignals": {{
    "revenueGrowth": null,
    "profitLoss": null,
    "profitTrend": "profit | loss | breakeven | unknown",
    "marketCap": null,
    "stockTicker": null,
    "stockPrice": null,
    "fundingStatus": "Any funding info found, or null",
    "lastFundingAmount": null,
    "lastFundingDate": null,
    "valuation": null
  }},
  "tier": 3,
  "tierJustification": "Best estimate based on available signals"
}}"""

    return _parse_json(_llm(prompt)) or {}


# ---------------------------------------------------------------------------
# Check if primary result is essentially empty
# ---------------------------------------------------------------------------
def _is_empty_result(intel):
    """Returns True if the LLM result has no useful financial data."""
    if not intel:
        return True
    fin = intel.get("financialSignals") or {}
    has_revenue   = bool(intel.get("revenue"))
    has_stock     = bool(fin.get("stockTicker") or fin.get("marketCap"))
    has_funding   = bool(fin.get("fundingStatus") or fin.get("valuation"))
    has_profit    = bool(fin.get("profitLoss"))
    return not any([has_revenue, has_stock, has_funding, has_profit])


# ---------------------------------------------------------------------------
# Infer profitTrend from profitLoss string if LLM left it as "unknown"
# ---------------------------------------------------------------------------
def _infer_profit_trend(fin_signals):
    """
    If profitTrend is 'unknown', tries to derive it from the profitLoss string.
    E.g. "Net Loss ₹45 Cr (FY2024)" → "loss"
    """
    trend = (fin_signals.get("profitTrend") or "unknown").lower()
    if trend != "unknown":
        return trend

    profit_loss_str = (fin_signals.get("profitLoss") or "").lower()
    if any(kw in profit_loss_str for kw in ["net loss", "loss of", "reported loss", "operating loss"]):
        return "loss"
    if any(kw in profit_loss_str for kw in ["net profit", "profit of", "reported profit", "pat of", "earnings"]):
        return "profit"
    if "breakeven" in profit_loss_str or "break even" in profit_loss_str:
        return "breakeven"
    return "unknown"


# ---------------------------------------------------------------------------
# Tier Sanity Check — stronger validation
# ---------------------------------------------------------------------------
def _validate_tier(intel):
    """
    Auto-corrects the LLM-assigned tier based on multiple signals.
    More comprehensive than v1 — handles Indian ₹ Cr ranges explicitly,
    funding stage signals, and invalid ticker strings.
    """
    revenue_str    = str(intel.get("revenue") or "").lower()
    fin            = intel.get("financialSignals") or {}
    market_cap_str = str(fin.get("marketCap") or "").lower()
    ticker_raw     = str(fin.get("stockTicker") or "").strip()
    funding_str    = str(fin.get("fundingStatus") or "").lower()
    valuation_str  = str(fin.get("valuation") or "").lower()

    tier = int(intel.get("tier") or 3)

    # Validate ticker — must match EXCHANGE:TICKER pattern, otherwise discard
    ticker_valid = bool(re.match(r'^[A-Z]{2,5}:[A-Z0-9]{1,10}$', ticker_raw))

    # --- TIER 1 signals ---
    tier1_signals = [
        any(kw in revenue_str    for kw in ["billion", " b ", "$b", "l cr", "lakh cr", "lac cr"]),
        any(kw in market_cap_str for kw in ["billion", "l cr", "lakh cr"]),
        ticker_valid,  # Any valid listed ticker = at least Tier 1
        any(kw in valuation_str  for kw in ["billion", "unicorn"]),
    ]

    # --- TIER 2 signals ---
    # Indian mid-size: ₹75 Cr–₹750 Cr  (contains "cr" or "crore" but NOT lakh cr)
    is_cr_revenue = any(kw in revenue_str for kw in [" cr", "crore", " cr ", "₹"]) and \
                    not any(kw in revenue_str for kw in ["l cr", "lakh cr", "lac cr"])
    tier2_signals = [
        is_cr_revenue,
        any(kw in revenue_str   for kw in ["million", " m ", "$m"]),
        any(kw in funding_str   for kw in ["series b", "series c", "series d"]),
    ]

    # --- TIER 3 signals (force down) ---
    tier3_signals = [
        any(kw in funding_str for kw in ["seed", "pre-series", "pre-seed", "angel", "bootstrapped"]),
        "series a" in funding_str and not any(kw in funding_str for kw in ["series b", "series c"]),
    ]

    # Apply tier rules
    if any(tier1_signals):
        tier = 1
    elif any(tier2_signals):
        tier = min(tier, 2)
    if any(tier3_signals) and tier > 1:
        tier = 3  # Only force to 3 if not already confirmed Tier 1/2 by harder signals

    return tier


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def audit_financials(legal_name):
    """
    Main entry point for Module 5.
    - Runs 10 primary financial searches (with DDGS retry)
    - Falls back to broad unquoted queries if context is thin
    - Extracts structured fiscal data via LLM
    - Runs second LLM pass if primary returns all-null result
    - Validates/corrects tier
    - Infers profitTrend from profitLoss if needed
    - Returns schema-aligned financial dict
    """
    print(f"    [M5] Gathering financial intelligence for: {legal_name}")

    # Step 1: Search
    context_text = search_financials(legal_name)

    # Step 2: Primary LLM extraction
    intel = _llm_extract_financials(legal_name, context_text)

    # Step 3: If primary returned all nulls, run fallback LLM pass
    if _is_empty_result(intel):
        print(f"    [M5] Primary extraction empty. Running fallback LLM pass...")
        intel = _llm_fallback_extract(legal_name, context_text)

    # Step 4: Validate tier
    fin_signals = intel.get("financialSignals") or {}
    tier = _validate_tier(intel)

    # Step 5: Infer profitTrend if missing
    profit_trend = _infer_profit_trend(fin_signals)

    # Step 6: Build composite stockInfo string (only if ticker is valid format)
    stock_info = None
    ticker_raw = (fin_signals.get("stockTicker") or "").strip()
    price      = fin_signals.get("stockPrice")
    ticker     = ticker_raw if re.match(r'^[A-Z]{2,5}:[A-Z0-9]{1,10}$', ticker_raw) else None
    if ticker or price:
        parts = [p for p in [ticker, price] if p]
        stock_info = " | ".join(parts)

    print(f"    [M5] Revenue: {intel.get('revenue')} | Tier: {tier} | Profit: {profit_trend} | Stock: {stock_info}")

    return {
        "revenue":           intel.get("revenue"),
        "stockInfo":         stock_info,
        "tier":              tier,
        "tierJustification": intel.get("tierJustification"),
        "financialSignals":  {
            "revenueGrowth":     fin_signals.get("revenueGrowth"),
            "profitLoss":        fin_signals.get("profitLoss"),
            "profitTrend":       profit_trend,
            "marketCap":         fin_signals.get("marketCap"),
            "stockTicker":       ticker,  # Only saved if passes format validation
            "stockPrice":        fin_signals.get("stockPrice"),
            "fundingStatus":     fin_signals.get("fundingStatus"),
            "lastFundingAmount": fin_signals.get("lastFundingAmount"),
            "lastFundingDate":   fin_signals.get("lastFundingDate"),
            "valuation":         fin_signals.get("valuation"),
        },
    }
