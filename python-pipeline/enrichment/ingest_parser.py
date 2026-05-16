"""
ingest_parser.py
────────────────
AI-powered parser for raw clipboard text from Apollo, LinkedIn, or RocketReach.
Transforms messy, unstructured text into structured lead data.
"""

import os, sys, json, re, argparse
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def init_groq():
    groq_key = os.environ.get('GROQ_API_KEY', '')
    if groq_key:
        try:
            from groq import Groq
            return Groq(api_key=groq_key)
        except: return None
    return None

def parse_raw_text(text):
    client = init_groq()
    if not client:
        return {"error": "Groq client not initialized"}

    prompt = f"""You are a Lead Intelligence Parser. 
Extract company and leadership data from this raw clipboard text (likely from Apollo/LinkedIn).

RAW TEXT:
\"\"\"
{text[:4000]}
\"\"\"

STRICT RULES:
1. Identify the company name, website, and industry.
2. Identify the lead person's name and designation.
3. Clean all LinkedIn URLs using the /company/ or /in/ format.
4. If an email is present, extract it.

Return ONLY valid JSON:
{{
  "name": "Company Name",
  "websiteUrl": "https://...",
  "domain": "SEPC Domain",
  "currentCeo": "Person Name",
  "description": "Short summary",
  "officialEmail": "email if found",
  "linkedinUrl": "company linkedin",
  "city": "city",
  "country": "country"
}}"""

    try:
        response = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0,
        )
        raw = response.choices[0].message.content.strip()
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as e:
        return {"error": str(e)}
    return {"error": "No JSON found"}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', required=True)
    args = parser.parse_args()
    
    result = parse_raw_text(args.text)
    print(json.dumps(result))
