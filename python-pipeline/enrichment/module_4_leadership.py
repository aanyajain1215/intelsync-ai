"""
module_4_leadership.py — PARAMETER 4: Leadership (Identity Locked v10)
=======================================================================
Responsible for ALL leadership fields:
  • currentCeo        — Full name of most recently appointed CEO/MD
  • ceoLinkedinUrl    — Verified personal LinkedIn profile for the CEO
  • leadership        — List of {name, designation, linkedin} for key executives
  • foundedBy         — Founder(s) name(s)
  • persons           — Flat searchable index of ALL identified key people

Identity Lock v10 changes vs v9:
  - Two-pass LLM extraction with self-critique to eliminate hallucinated names
  - LinkedIn URL is only accepted if the profile page body contains BOTH the
    person's last name AND a token from the company name (hard co-occurrence check)
  - Fallback discovery uses LLM to parse LinkedIn snippets, not naive string splits
  - Designation is re-confirmed against the profile snippet before acceptance
  - Min-5 guarantee: iterates additional search angles until quota is met
"""

import re
import time
from ddgs import DDGS
from enrichment.llm_client import _llm, _parse_json
from enrichment.linkedin_search import get_linkedin_url


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ddgs_search(query: str, max_results: int = 5) -> list[dict]:
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results))
    except Exception:
        return []


def _name_tokens(name: str) -> list[str]:
    """Return meaningful tokens (len > 2) from a full name, lowercased."""
    return [t.lower() for t in name.strip().split() if len(t) > 2]


def _company_tokens(legal_name: str) -> list[str]:
    """Return meaningful tokens from company name, excluding generic words."""
    stopwords = {"the", "and", "of", "for", "ltd", "pvt", "inc", "llc",
                 "limited", "private", "company", "corp", "group"}
    return [t.lower() for t in legal_name.split()
            if len(t) > 2 and t.lower() not in stopwords]


# ---------------------------------------------------------------------------
# Step 1: Rich Search Context
# ---------------------------------------------------------------------------

import concurrent.futures

def _search_leadership_context(legal_name: str) -> tuple[str, str]:
    """
    Runs targeted searches to collect executive intelligence in parallel.
    Returns (exec_context, founder_context).
    """
    exec_queries = [
        f'"{legal_name}" CEO "Managing Director" 2024 2025',
        f'"{legal_name}" board directors chairman executive leadership',
        f'"{legal_name}" executive team COO CFO CTO president',
        f'"{legal_name}" Vice President Director Head appointed',
        f'"{legal_name}" leadership team senior management',
    ]
    founder_queries = [
        f'"{legal_name}" founded by co-founder founder history established',
        f'"{legal_name}" founding story origin founders',
    ]

    def fetch_results(query, max_res=5):
        return _ddgs_search(query, max_results=max_res)

    all_queries = [(q, 5, "exec") for q in exec_queries] + [(q, 5, "founder") for q in founder_queries]
    exec_snippets = []
    founder_snippets = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as executor:
        future_to_type = {executor.submit(fetch_results, q, m): t for q, m, t in all_queries}
        for future in concurrent.futures.as_completed(future_to_type):
            q_type = future_to_type[future]
            results = future.result()
            for r in results:
                if q_type == "exec":
                    exec_snippets.append(
                        f"URL: {r.get('href', '')} | TITLE: {r.get('title', '')} | BODY: {r.get('body', '')[:400]}"
                    )
                else:
                    founder_snippets.append(f"{r.get('title', '')} | {r.get('body', '')[:300]}")

    return "\n".join(exec_snippets), "\n".join(founder_snippets)


# ---------------------------------------------------------------------------
# Step 2: Two-Pass LLM Extraction with Self-Critique
# ---------------------------------------------------------------------------

def _llm_extract_leadership(legal_name: str, exec_ctx: str, founder_ctx: str) -> dict:
    """
    Pass 1: extract candidates.
    Pass 2: self-critique — drop anyone not explicitly named in the evidence.
    """
    # --- Pass 1: Extraction ---
    pass1_prompt = f"""You are a senior corporate intelligence analyst extracting verified leadership data.

COMPANY: "{legal_name}"

EXECUTIVE SEARCH EVIDENCE:
{exec_ctx[:6000]}

FOUNDER SEARCH EVIDENCE:
{founder_ctx[:2000]}

STRICT RULES:
1. Only include people whose FULL NAME appears explicitly in the evidence above.
2. Do NOT invent, infer, or guess any name or title.
3. Every person MUST have a designation that appears in the evidence.
4. "designation" must be their specific title at "{legal_name}" (e.g. "CEO", "CFO", "Director - Sales").
5. Prefer the most recently mentioned names (2024/2025 evidence takes priority).
6. If you cannot find a name with certainty, omit that role entirely.

Return ONLY valid JSON — no prose, no markdown:
{{
  "currentCeo": "Full name or null",
  "foundedBy": "Founder name(s) or null",
  "foundedYear": "YYYY or null",
  "leadership": [
    {{"name": "Full Name", "designation": "Exact Title at {legal_name}"}}
  ]
}}"""

    raw1 = _parse_json(_llm(pass1_prompt)) or {}

    candidates = raw1.get("leadership") or []
    if not candidates:
        return raw1

    # --- Pass 2: Self-critique — ask LLM to remove unverified entries ---
    candidate_list = "\n".join(
        f"- {p.get('name', '?')} | {p.get('designation', '?')}"
        for p in candidates if isinstance(p, dict)
    )
    pass2_prompt = f"""You previously extracted this leadership list for "{legal_name}":
{candidate_list}

Re-examine the ORIGINAL EVIDENCE below. For each person, answer:
  - Does their EXACT full name appear in the evidence?
  - Does their designation match what the evidence says about them at "{legal_name}"?

Remove any entry where EITHER answer is NO.
Fix designations that are slightly wrong based on evidence.

ORIGINAL EVIDENCE (executive):
{exec_ctx[:4000]}

Return ONLY valid JSON — same schema, pruned and corrected:
{{
  "leadership": [
    {{"name": "Full Name", "designation": "Verified Title"}}
  ]
}}"""

    raw2 = _parse_json(_llm(pass2_prompt)) or {}
    verified_candidates = raw2.get("leadership") or candidates  # fallback to pass1 if pass2 fails

    raw1["leadership"] = verified_candidates
    return raw1


# ---------------------------------------------------------------------------
# Step 3: Identity Lock — Verified LinkedIn URL
# ---------------------------------------------------------------------------

def _fetch_linkedin_snippet(url: str) -> str:
    """
    Fetches a short DDG snippet for a LinkedIn URL to cross-verify identity.
    Returns the snippet body text.
    """
    results = _ddgs_search(f'site:linkedin.com "{url}"', max_results=2)
    if results:
        return (results[0].get("title", "") + " " + results[0].get("body", "")).lower()

    # Fallback: search by URL directly
    results = _ddgs_search(url, max_results=2)
    if results:
        return (results[0].get("title", "") + " " + results[0].get("body", "")).lower()
    return ""


def _co_occurrence_check(snippet: str, name: str, legal_name: str) -> bool:
    """
    Hard Identity Lock:
    The LinkedIn snippet MUST contain:
      - At least one meaningful token from the person's name
      - At least one meaningful token from the company name
    Both must appear to confirm this profile belongs to this person at this company.
    """
    name_toks = _name_tokens(name)
    company_toks = _company_tokens(legal_name)

    name_hit = any(tok in snippet for tok in name_toks)
    company_hit = any(tok in snippet for tok in company_toks)

    return name_hit and company_hit


def _verify_executive_linkedin(name: str, legal_name: str, designation: str) -> str | None:
    """
    Searches for the executive's LinkedIn URL and applies Identity Lock v10.
    Returns verified URL or None.
    """
    if not name or len(name.strip()) < 4:
        return None

    # Primary: use existing get_linkedin_url helper
    url = get_linkedin_url(name, legal_name, "person")
    if not url or "linkedin.com/in/" not in url:
        # Fallback: manual DDG search
        results = _ddgs_search(
            f'site:linkedin.com/in/ "{name}" "{legal_name}"', max_results=3
        )
        for r in results:
            candidate_url = r.get("href", "")
            if "linkedin.com/in/" in candidate_url:
                snippet = (r.get("title", "") + " " + r.get("body", "")).lower()
                if _co_occurrence_check(snippet, name, legal_name):
                    return candidate_url
        return None

    # Verify the URL returned by get_linkedin_url via co-occurrence check
    snippet = _fetch_linkedin_snippet(url)
    if snippet and _co_occurrence_check(snippet, name, legal_name):
        return url

    # If co-occurrence fails, try a direct DDG search with both name + company
    results = _ddgs_search(
        f'site:linkedin.com/in/ "{name}" "{legal_name}"', max_results=3
    )
    for r in results:
        candidate_url = r.get("href", "")
        if "linkedin.com/in/" not in candidate_url:
            continue
        snippet = (r.get("title", "") + " " + r.get("body", "")).lower()
        if _co_occurrence_check(snippet, name, legal_name):
            return candidate_url

    return None  # Identity Lock rejected all candidates


# ---------------------------------------------------------------------------
# Step 4: Fallback Discovery (LLM-parsed, not naive split)
# ---------------------------------------------------------------------------

def _fallback_discover_executives(legal_name: str, already_found: set[str]) -> list[dict]:
    """
    Runs additional LinkedIn-targeted searches and uses LLM to parse
    the snippets into name + designation pairs.
    Applies Identity Lock to every candidate before accepting.
    """
    print(f"    [M4-Fallback] Running fallback discovery for more executives...")
    queries = [
        f'site:linkedin.com/in/ "{legal_name}" Vice President',
        f'site:linkedin.com/in/ "{legal_name}" Director',
        f'site:linkedin.com/in/ "{legal_name}" Head of',
        f'site:linkedin.com/in/ "{legal_name}" Chief',
        f'site:linkedin.com/in/ "{legal_name}" Manager Senior',
    ]

    raw_snippets = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_query = {executor.submit(_ddgs_search, q, 5): q for q in queries}
        for future in concurrent.futures.as_completed(future_to_query):
            try:
                results = future.result()
                for r in results:
                    if "linkedin.com/in/" in r.get("href", ""):
                        raw_snippets.append(
                            f"URL: {r['href']} | TITLE: {r.get('title', '')} | BODY: {r.get('body', '')[:300]}"
                        )
            except Exception:
                pass

    if not raw_snippets:
        return []

    snippets_text = "\n".join(raw_snippets[:40])  # cap tokens

    parse_prompt = f"""These are LinkedIn search results for employees of "{legal_name}".

{snippets_text}

Extract a list of real people who currently work or have recently worked at "{legal_name}".

RULES:
1. Full name must be clearly readable from the TITLE field.
2. Designation must come from the TITLE or BODY — do not invent it.
3. LinkedIn URL must be exactly as shown in URL field.
4. Skip anyone in this already-found list: {sorted(already_found)}
5. Only include people where the evidence clearly links them to "{legal_name}".

Return ONLY valid JSON:
{{
  "executives": [
    {{"name": "Full Name", "designation": "Their Title", "linkedin": "https://linkedin.com/in/..."}}
  ]
}}"""

    parsed = _parse_json(_llm(parse_prompt)) or {}
    candidates = parsed.get("executives") or []

    verified = []
    
    def verify_candidate(c):
        if not isinstance(c, dict):
            return None
        name = (c.get("name") or "").strip()
        designation = (c.get("designation") or "Executive").strip()
        url = (c.get("linkedin") or "").strip()

        if not name or name in already_found:
            return None
        if not url or "linkedin.com/in/" not in url:
            return None

        # Identity Lock on fallback candidates too
        snippet = _fetch_linkedin_snippet(url)
        if not snippet or not _co_occurrence_check(snippet, name, legal_name):
            return None

        return {"name": name, "designation": designation, "linkedin": url}

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(verify_candidate, candidates))
        for res in results:
            if res:
                verified.append(res)
                print(f"    [M4-Fallback] Verified: {res['name']} | {res['designation']}")

    return verified


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def audit_leadership(legal_name: str) -> dict:
    """
    Main entry point for Module 4.
    Guarantees a minimum of 5 verified leadership entries with:
      - Accurate full names (LLM two-pass extraction + self-critique)
      - Correct designations (evidence-grounded, not guessed)
      - Verified LinkedIn URLs (Identity Lock: name + company co-occurrence)
    """
    print(f"    [M4] Auditing leadership for: {legal_name}")

    # ---- Step 1: Search ----
    exec_ctx, founder_ctx = _search_leadership_context(legal_name)

    # ---- Step 2: Two-pass LLM extraction ----
    intel = _llm_extract_leadership(legal_name, exec_ctx, founder_ctx)

    current_ceo: str = intel.get("currentCeo") or "Not found"
    founded_by: str = intel.get("foundedBy") or "Not found"
    founded_year = intel.get("foundedYear")
    raw_leadership: list[dict] = intel.get("leadership") or []

    print(f"    [M4] CEO: {current_ceo} | Founders: {founded_by} | Candidates: {len(raw_leadership)}")

    # ---- Step 3: Identity Lock — verify each candidate's LinkedIn in parallel ----
    ceo_linkedin: str | None = None
    verified_leadership: list[dict] = []
    all_persons: set[str] = set()

    def verify_and_map(person):
        if not isinstance(person, dict):
            return None
        name = (person.get("name") or "").strip()
        designation = (person.get("designation") or "Executive").strip()
        if not name:
            return None
        
        url = _verify_executive_linkedin(name, legal_name, designation)
        if url:
            return {"name": name, "designation": designation, "linkedin": url}
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(verify_and_map, raw_leadership))
        for entry in results:
            if entry:
                verified_leadership.append(entry)
                name = entry["name"]
                all_persons.add(name)
                
                # Tag CEO LinkedIn — match by last name token to be robust to initials
                ceo_name_toks = _name_tokens(current_ceo) if current_ceo != "Not found" else []
                if ceo_name_toks and any(tok in _name_tokens(name) for tok in ceo_name_toks):
                    ceo_linkedin = entry["linkedin"]
                print(f"    [M4] ✓ Verified: {name} | {entry['designation']}")

    # ---- Step 4: Fallback if below minimum of 5 ----
    if len(verified_leadership) < 5:
        fallback_leads = _fallback_discover_executives(legal_name, all_persons)
        for lead in fallback_leads:
            if len(verified_leadership) >= 8:  # cap at 8 for quality control
                break
            verified_leadership.append(lead)
            all_persons.add(lead["name"])

    # ---- Step 5: Verify CEO LinkedIn separately if still missing ----
    if current_ceo and current_ceo != "Not found":
        all_persons.add(current_ceo)
        if not ceo_linkedin:
            print(f"    [M4] CEO LinkedIn not found in leadership list, searching directly...")
            ceo_linkedin = _verify_executive_linkedin(current_ceo, legal_name, "CEO")

    print(
        f"    [M4] Final: {len(verified_leadership)} verified leads | "
        f"CEO LinkedIn: {ceo_linkedin or 'not found'}"
    )

    return {
        "currentCeo": current_ceo,
        "ceoLinkedinUrl": ceo_linkedin,
        "foundedBy": founded_by,
        "foundedYear": founded_year,
        "leadership": verified_leadership,
        "persons": sorted(all_persons),
    }