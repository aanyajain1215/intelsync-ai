"""
llm_client.py
─────────────
Centralized LLM connection handler for the IntelSync AI engine.
Handles Gemini -> Groq fallback and robust JSON parsing.
"""

import os
import re
import json
from dotenv import load_dotenv

# Load env from parent dir
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

groq_client = None
gemini_client = None
_gemini_exhausted = False

def init_clients():
    global groq_client, gemini_client
    
    # Initialize Groq
    groq_key = os.environ.get('GROQ_API_KEY', '')
    if groq_key and not groq_key.startswith('your_'):
        try:
            from groq import Groq
            groq_client = Groq(api_key=groq_key)
        except Exception as e:
            print(f"    [WARN] Groq Init Error: {e}")

    # Initialize Gemini
    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    if gemini_key and not gemini_key.startswith('your_'):
        try:
            from google import genai
            gemini_client = genai.Client(api_key=gemini_key)
        except Exception as e:
            print(f"    [WARN] Gemini Init Error: {e}")

def _llm(prompt, temperature=0):
    """Executes a prompt with automatic model fallback."""
    global _gemini_exhausted, gemini_client, groq_client
    
    if not gemini_client and not groq_client:
        init_clients()

    # 1. Try Gemini (Flash 2.0)
    if gemini_client and not _gemini_exhausted:
        try:
            r = gemini_client.models.generate_content(model='gemini-2.0-flash', contents=prompt)
            return r.text.strip()
        except Exception as e:
            if '429' in str(e) or 'RESOURCE_EXHAUSTED' in str(e):
                _gemini_exhausted = True
                print("    [!] Gemini Quota Exhausted. Switching to Groq fallback.")
            else:
                print(f"    [WARN] Gemini error: {e}")

    # 2. Try Groq (Llama 3.3 70B - Versatile)
    if groq_client:
        try:
            r = groq_client.chat.completions.create(
                model='llama-3.3-70b-versatile',
                messages=[{'role': 'user', 'content': prompt}],
                temperature=temperature,
            )
            return r.choices[0].message.content.strip()
        except Exception as e:
            if '429' in str(e):
                # 3. Last Resort: Groq (Llama 3.1 8B - Fast)
                try:
                    r = groq_client.chat.completions.create(
                        model='llama-3.1-8b-instant',
                        messages=[{'role': 'user', 'content': prompt}],
                        temperature=temperature,
                    )
                    return r.choices[0].message.content.strip()
                except:
                    pass
            print(f"    [WARN] Groq error: {e}")
    
    return ''

def _parse_json(text):
    """Robustly extracts and parses JSON from LLM output."""
    if not text: return None
    try:
        # Look for JSON patterns
        for pattern in [r'\{.*\}', r'\[.*\]']:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                return json.loads(match.group())
        # Direct attempt
        return json.loads(text)
    except:
        return None
