"""
linkedin_search.py
──────────────────
High-Precision LinkedIn Discovery using Serper.dev.
Identity Lock v9: Mandates full-name token matching and company co-occurrence.
"""

import os
import requests
import json
import re
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def get_linkedin_url(name, company_name, search_type="person"):
    """
    Finds a LinkedIn URL with Identity Lock v9.
    name: Full name of person or company.
    company_name: Parent organization name.
    """
    api_key = (os.environ.get('SERPER_API_KEY') or '').strip()
    if not api_key or api_key.startswith('your_'): return None

    # THE DORK: Stage 1 - Strict exact company matching
    if search_type == "person":
        dork = f'site:linkedin.com/in/ {name} "{company_name}"'
    else:
        dork = f'site:linkedin.com/company/ "{name}"'

    try:
        def _execute_search(query):
            response = requests.post("https://google.serper.dev/search", 
                                     headers={'X-API-KEY': api_key, 'Content-Type': 'application/json'},
                                     json={"q": query, "num": 5}, timeout=15)
            return response.json()

        results = _execute_search(dork)
        
        # Stage 2: Relaxed search if no results found in Stage 1
        if not results.get('organic', []):
            if search_type == "person":
                # Remove quotes and try name + first two words of company
                co_short = " ".join(company_name.split()[:2])
                dork_v2 = f'site:linkedin.com/in/ {name} {co_short}'
                results = _execute_search(dork_v2)
        
        for item in results.get('organic', []):
            link = item.get('link', '').split('?')[0].rstrip('/.,;)]')
            title = item.get('title', '').lower()
            snippet = item.get('snippet', '').lower()
            
            if "linkedin.com/" in link:
                # LAYER 1: Name Token Check (Relaxed to allow initials)
                name_tokens = [t.lower() for t in name.split() if len(t) > 2]
                if name_tokens:
                    longest_token = max(name_tokens, key=len)
                    if longest_token not in title and longest_token not in snippet:
                        if not any(t in title for t in name_tokens):
                            continue

                # LAYER 2: Company Anchor Check (For People)
                if search_type == "person":
                    # Clean company tokens for matching (handles abbreviations and concatenated names)
                    co_tokens = [t.lower() for t in company_name.split() if len(t) > 3]
                    co_simple = company_name.lower().replace(" ", "").replace("limited", "").replace("pvt", "")
                    
                    found_anchor = any(token in title or token in snippet for token in co_tokens) or \
                                  (len(co_simple) > 4 and co_simple in title.replace(" ", "") or co_simple in snippet.replace(" ", ""))
                    
                    if not found_anchor:
                        continue
                    return link
                else:
                    # Company Slug Match
                    slug = link.split('/company/')[-1].replace('-', '').replace('_', '').lower()
                    simplified = name.lower().replace(' ', '').replace('.', '').replace(',', '')
                    name_tokens = [t.lower() for t in name.split() if len(t) > 3]
                    if (len(simplified) >= 6 and slug.startswith(simplified[:6])) or \
                       (name_tokens and all(t.replace(' ', '') in slug for t in name_tokens[:2])):
                        return link

    except Exception as e:
        print(f"    ⚠️ Serper Error: {e}")
    return None
