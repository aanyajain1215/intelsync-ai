"""
module_3_contact.py — PARAMETER 3: Contact & Location
=======================================================
Responsible for ALL contact and location fields:
  • officialEmail         — Primary corporate contact address
  • phones                — List of direct/office numbers
  • linkedinUrl           — Verified company LinkedIn page URL
  • headquartersAddress   — Full physical address of main office
  • city                  — City name
  • country               — Country name

Uses 6 targeted search streams: contact page, email/phone patterns,
site-specific dorking, LinkedIn, and address records.
"""

import re
import time
import concurrent.futures
from ddgs import DDGS
from enrichment.llm_client import _llm, _parse_json
from enrichment.linkedin_search import get_linkedin_url

# -- Regex patterns ---------------------------------------------------------
EMAIL_PATTERN = re.compile(
    r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'
)
PHONE_PATTERN = re.compile(
    r'(?:\+?[\d\-\s().]{7,20})'
)
LINKEDIN_COMPANY_PATTERN = re.compile(
    r'linkedin\.com/company/[a-zA-Z0-9\-_]+', re.IGNORECASE
)


def _ddgs_search(query, max_results=5):
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results))
    except Exception:
        return []


def _clean_linkedin_url(url):
    """Normalizes a LinkedIn company URL — strips query params, trailing junk."""
    if not url or "linkedin.com" not in url:
        return None
    url = url.strip().split("?")[0].split("#")[0].rstrip("/.,;)]'\"")
    if not url.startswith("http"):
        url = "https://" + url
    match = LINKEDIN_COMPANY_PATTERN.search(url)
    return "https://" + match.group(0) if match else None


def _extract_emails_from_snippets(results):
    """Extracts email addresses from raw DDGS result snippets."""
    emails = set()
    for r in results:
        text = r.get("body", "") + " " + r.get("title", "")
        found = EMAIL_PATTERN.findall(text)
        for e in found:
            # Skip generic/common non-corporate emails
            if not any(x in e.lower() for x in ["example", "test@", "noreply", "no-reply"]):
                emails.add(e.lower())
    return list(emails)


def _extract_phones_from_snippets(results):
    """Extracts phone numbers from raw DDGS result snippets."""
    phones = set()
    for r in results:
        text = r.get("body", "")
        found = PHONE_PATTERN.findall(text)
        for p in found:
            cleaned = re.sub(r'\s+', ' ', p).strip()
            # Must have at least 7 digits
            if len(re.sub(r'\D', '', cleaned)) >= 7:
                phones.add(cleaned)
    return list(phones)[:10]  # Cap at 10


# -- Dedicated Search Streams -----------------------------------------------
def _run_contact_searches(legal_name, domain_only):
    """
    Runs 6 targeted search dorks to gather all contact intelligence.
    Returns list of result dicts and a combined snippet text.
    """
    queries = [
        f'"{legal_name}" contact us email phone address',
        f'"{legal_name}" headquarters office address city country',
        f'"{legal_name}" info@ OR contact@ OR support@ OR admin@ email',
        f'site:linkedin.com/company "{legal_name}"',
    ]
    if domain_only:
        queries += [
            f'site:{domain_only} contact OR about OR email OR phone',
            f'site:{domain_only} headquarters OR address OR location',
        ]

    all_results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(queries)) as executor:
        futures = {executor.submit(_ddgs_search, q, 4): q for q in queries}
        for future in concurrent.futures.as_completed(futures):
            try:
                results = future.result()
                all_results.extend(results)
            except Exception:
                pass

    return all_results


# -- LinkedIn Company URL ---------------------------------------------------
def _get_company_linkedin(legal_name):
    """
    Gets verified LinkedIn company page URL.
    Tries Serper first; falls back to DDGS snippet extraction.
    """
    # Try Serper-based verified search
    url = get_linkedin_url(legal_name, legal_name, "company")
    if url:
        return url

    # Fallback: DDGS snippet extraction
    results = _ddgs_search(f'site:linkedin.com/company "{legal_name}"', max_results=3)
    for r in results:
        href = r.get("href", "")
        cleaned = _clean_linkedin_url(href)
        if cleaned:
            return cleaned
    return None


# -- LLM Extraction ---------------------------------------------------------
def _llm_extract_contact(legal_name, all_results, raw_emails, raw_phones):
    """
    Passes all gathered text to the LLM for structured contact extraction.
    """
    snippet_text = "\n".join(
        f"URL: {r.get('href','')} | {r.get('title','')} | {r.get('body','')[:250]}"
        for r in all_results[:15]
    )

    prompt = f"""You are a corporate intelligence analyst extracting contact data for "{legal_name}".

SEARCH EVIDENCE:
{snippet_text[:6000]}

PRE-EXTRACTED SIGNALS:
- Potential Emails Found: {raw_emails[:5]}
- Potential Phones Found: {raw_phones[:5]}

EXTRACTION RULES:
1. OFFICIAL EMAIL: Pick the most authoritative corporate email (prefer info@, contact@, or domain-matching).
   Never return personal emails (gmail, yahoo, etc.) unless that's the only option.
2. PHONES: List all valid office/direct numbers with country code if visible.
3. HEADQUARTERS ADDRESS: Full physical address — Street, Area, City, State, Country, PIN/ZIP.
4. CITY & COUNTRY: Extract from the HQ address or any official source.
5. If a field cannot be determined from evidence, return null — DO NOT guess.

Return ONLY valid JSON:
{{
  "officialEmail": "email or null",
  "phones": ["number1", "number2"],
  "headquartersAddress": "Full address or null",
  "city": "City or null",
  "country": "Country or null"
}}"""

    return _parse_json(_llm(prompt)) or {}


# -- Public API -------------------------------------------------------------
def audit_contacts(legal_name, domain_only=""):
    """
    Main entry point for Module 3.
    Runs 6 search streams, extracts emails/phones via regex, verifies LinkedIn,
    then uses LLM to synthesize structured contact & location data.
    """
    print(f"    [M3] Gathering contact & location for: {legal_name}")

    # Step 1: Run all contact searches
    all_results = _run_contact_searches(legal_name, domain_only)

    # Step 2: Pre-extract emails and phones via regex (pre-filter for LLM)
    raw_emails = _extract_emails_from_snippets(all_results)
    raw_phones = _extract_phones_from_snippets(all_results)

    # Step 3: Get verified LinkedIn company URL
    linkedin_url = _get_company_linkedin(legal_name)
    print(f"    [M3] LinkedIn: {linkedin_url or 'not found'}")

    # Step 4: LLM structured extraction
    intel = _llm_extract_contact(legal_name, all_results, raw_emails, raw_phones)

    # Step 5: Merge regex-found phones with LLM-found phones (deduplicate)
    llm_phones = intel.get("phones") or []
    merged_phones = list(dict.fromkeys(llm_phones + raw_phones))[:8]

    print(f"    [M3] Email: {intel.get('officialEmail')} | City: {intel.get('city')} | Country: {intel.get('country')}")

    return {
        "officialEmail": intel.get("officialEmail"),
        "phones": merged_phones,
        "linkedinUrl": linkedin_url,
        "headquartersAddress": intel.get("headquartersAddress"),
        "city": intel.get("city"),
        "country": intel.get("country"),
    }
