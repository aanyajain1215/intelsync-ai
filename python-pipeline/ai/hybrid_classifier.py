"""
hybrid_classifier.py
────────────────────
Classifies companies into 6 SEPC domains using rule-based + LLM fallback.
Domains: Media and Entertainment, Education, Healthcare, Tourism, Financial services, Consultancy services
"""

import re
import json

SEPC_DOMAINS = [
    'Media and Entertainment',
    'Education',
    'Healthcare',
    'Tourism',
    'Financial services',
    'Consultancy services',
]

# ── Rule-Based Keyword Map ──────────────────────────────────────
KEYWORD_MAP = {
    'Media and Entertainment': [
        'media', 'entertainment', 'film', 'movie', 'animation', 'vfx', 'gaming',
        'broadcast', 'television', 'music', 'production house', 'streaming',
        'post-production', 'visual effects', 'studio', 'content creation',
        'publishing', 'advertising', 'digital media', 'ott', 'cinema',
    ],
    'Education': [
        'education', 'university', 'college', 'school', 'edtech', 'e-learning',
        'academic', 'institute', 'training', 'learning', 'coaching', 'tutorial',
        'curriculum', 'pedagogy', 'research', 'scholarship', 'higher education',
        'k-12', 'mooc', 'certification', 'skill development',
    ],
    'Healthcare': [
        'health', 'healthcare', 'hospital', 'medical', 'pharma', 'pharmaceutical',
        'biotech', 'clinical', 'diagnostic', 'wellness', 'telemedicine',
        'healthtech', 'nursing', 'therapy', 'patient', 'surgical', 'dental',
        'mental health', 'ayurveda', 'yoga', 'life sciences',
    ],
    'Tourism': [
        'tourism', 'travel', 'hotel', 'hospitality', 'resort', 'tour operator',
        'destination', 'booking', 'airline', 'cruise', 'adventure', 'eco-tourism',
        'spiritual tourism', 'heritage', 'pilgrimage', 'safari', 'lodge',
        'vacation', 'sightseeing', 'accommodation',
    ],
    'Financial services': [
        'finance', 'financial', 'banking', 'bank', 'fintech', 'insurance',
        'investment', 'capital', 'wealth management', 'asset management',
        'forex', 'stock', 'mutual fund', 'lending', 'credit', 'payment',
        'accounting', 'audit', 'tax', 'securities', 'brokerage', 'neobank',
    ],
    'Consultancy services': [
        'consulting', 'consultancy', 'advisory', 'management consulting',
        'strategy', 'business process', 'outsourcing', 'bpo', 'kpo',
        'corporate', 'professional services', 'legal', 'hr consulting',
        'it consulting', 'technology consulting', 'digital transformation',
    ],
}

SUB_CATEGORIES = {
    'Media and Entertainment': ['Animation & VFX', 'Film & Distribution', 'Gaming', 'Digital Media', 'Broadcasting', 'Music & Audio'],
    'Education': ['K-12 Schools', 'Higher Education', 'EdTech Platforms', 'Research Institutes', 'Skill Development', 'Coaching & Tutorials'],
    'Healthcare': ['Hospitals & Clinics', 'HealthTech', 'Pharma & Biotech', 'Wellness & Ayurveda', 'Medical Devices', 'Mental Health'],
    'Tourism': ['Hotels & Resorts', 'Tour Operators', 'Adventure Tourism', 'Eco Tourism', 'Spiritual Tourism', 'Travel Tech'],
    'Financial services': ['FinTech', 'Banking & Forex', 'Wealth Management', 'Insurance', 'Payments', 'Accounting & Audit'],
    'Consultancy services': ['Management Consulting', 'IT Consulting', 'Legal Advisory', 'HR Consulting', 'BPO/KPO', 'Strategy'],
}


def classify_rule_based(company_name, description='', industry=''):
    """Score each domain by keyword match count."""
    text = f"{company_name} {description} {industry}".lower()
    scores = {}
    for domain, keywords in KEYWORD_MAP.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[domain] = score

    if not scores:
        return None, 0, None, 'rule'

    best = max(scores, key=scores.get)
    confidence = min(scores[best] / 3, 1.0)  # Normalize: 3+ matches = 100%
    return best, confidence, _pick_subcategory(best, text), 'rule'


def _pick_subcategory(domain, text):
    subs = SUB_CATEGORIES.get(domain, [])
    for sub in subs:
        if any(w.lower() in text for w in sub.split()):
            return sub
    return subs[0] if subs else None


def classify_with_llm(company_name, description, groq_client):
    """LLM fallback for ambiguous classification."""
    if not groq_client:
        return None, 0, None, 'llm_unavailable'

    prompt = f"""Classify this company into ONE of these 6 SEPC domains:
1. Media and Entertainment
2. Education
3. Healthcare
4. Tourism
5. Financial services
6. Consultancy services

Company: {company_name}
Description: {description[:500] if description else 'N/A'}

If the company does NOT fit ANY domain, return "Out of Scope".

Return ONLY valid JSON:
{{"domain": "...", "subCategory": "...", "confidence": 0.0-1.0, "reason": "brief reason"}}"""

    try:
        response = groq_client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0,
        )
        raw = response.choices[0].message.content.strip()
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
            domain = data.get('domain', '')
            if domain in SEPC_DOMAINS:
                return domain, data.get('confidence', 0.7), data.get('subCategory'), 'llm'
            elif domain == 'Out of Scope':
                return None, 0, None, 'llm_out_of_scope'
    except Exception as e:
        print(f"    ⚠️ LLM classification error: {e}")

    return None, 0, None, 'llm_error'


def classify_company(company_name, description='', industry='', groq_client=None):
    """Hybrid classification: rule-based first, LLM fallback."""
    domain, confidence, sub_cat, method = classify_rule_based(company_name, description, industry)

    if domain and confidence >= 0.5:
        return {
            'domain': domain,
            'subCategory': sub_cat,
            'domainConfidence': round(confidence, 2),
            'domainReason': f'Rule-based match ({method})',
            'classifiedBy': 'rule',
        }

    # LLM fallback
    if groq_client:
        llm_domain, llm_conf, llm_sub, llm_method = classify_with_llm(company_name, description or industry, groq_client)
        if llm_domain:
            return {
                'domain': llm_domain,
                'subCategory': llm_sub,
                'domainConfidence': round(llm_conf, 2),
                'domainReason': f'LLM classification ({llm_method})',
                'classifiedBy': 'llm',
            }

    # Return best rule-based even if low confidence
    if domain:
        return {
            'domain': domain,
            'subCategory': sub_cat,
            'domainConfidence': round(confidence, 2),
            'domainReason': f'Low confidence rule match',
            'classifiedBy': 'rule_low',
        }

    return {
        'domain': None,
        'subCategory': None,
        'domainConfidence': 0,
        'domainReason': 'Could not classify into any SEPC domain',
        'classifiedBy': 'unclassified',
    }


# ── Pre-filter for CSV import ──────────────────────────────────
def is_sepc_relevant(industry_str):
    """Quick check if an industry string maps to any SEPC domain."""
    if not industry_str:
        return False
    text = industry_str.lower()
    for keywords in KEYWORD_MAP.values():
        if any(kw in text for kw in keywords):
            return True
    return False
