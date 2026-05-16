"""
import_to_mongo.py
──────────────────
Imports the CSV dataset into MongoDB, PRE-FILTERING for 6 SEPC domains only.
Maps CSV columns to the Company schema.
"""

import os
import sys
import csv
import math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

import pymongo
from ai.hybrid_classifier import is_sepc_relevant, classify_company


# Industry strings that map to SEPC domains
SEPC_INDUSTRY_MAP = {
    # Media & Entertainment
    'media production': 'Media and Entertainment',
    'entertainment': 'Media and Entertainment',
    'animation': 'Media and Entertainment',
    'motion pictures and film': 'Media and Entertainment',
    'broadcast media': 'Media and Entertainment',
    'music': 'Media and Entertainment',
    'publishing': 'Media and Entertainment',
    'online media': 'Media and Entertainment',
    'computer games': 'Media and Entertainment',

    # Education
    'education management': 'Education',
    'higher education': 'Education',
    'e-learning': 'Education',
    'primary/secondary education': 'Education',
    'professional training & coaching': 'Education',
    'research': 'Education',

    # Healthcare
    'hospital & health care': 'Healthcare',
    'health, wellness and fitness': 'Healthcare',
    'medical devices': 'Healthcare',
    'medical practice': 'Healthcare',
    'pharmaceuticals': 'Healthcare',
    'biotechnology': 'Healthcare',
    'mental health care': 'Healthcare',
    'alternative medicine': 'Healthcare',

    # Tourism
    'hospitality': 'Tourism',
    'leisure, travel & tourism': 'Tourism',
    'airlines/aviation': 'Tourism',
    'recreational facilities and services': 'Tourism',

    # Financial Services
    'financial services': 'Financial services',
    'banking': 'Financial services',
    'insurance': 'Financial services',
    'investment banking': 'Financial services',
    'investment management': 'Financial services',
    'venture capital & private equity': 'Financial services',
    'capital markets': 'Financial services',
    'accounting': 'Financial services',

    # Consultancy Services
    'management consulting': 'Consultancy services',
    'business supplies and equipment': 'Consultancy services',
    'human resources': 'Consultancy services',
    'staffing and recruiting': 'Consultancy services',
    'outsourcing/offshoring': 'Consultancy services',
    'legal services': 'Consultancy services',
    'public relations and communications': 'Consultancy services',
}


def import_csv_to_mongo(csv_path, batch_size=500, max_records=None, country_filter=None):
    """
    Import pre-filtered CSV data into MongoDB.
    Only imports companies whose industry matches one of the 6 SEPC domains.
    """
    mongo_uri = os.environ.get('MONGO_URI', '')
    client = pymongo.MongoClient(mongo_uri)
    db = client.get_database()
    collection = db['companies']

    print(f"\n📂 Reading CSV: {csv_path}")
    if country_filter:
        print(f"🌍 Filter enabled: {country_filter.title()} only")
    print(f"🔍 Pre-filtering for 6 SEPC domains only...")

    imported = 0
    skipped = 0
    batch = []

    with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)

        for row in reader:
            row_country = (row.get('country', '') or '').strip().lower()
            
            # COUNTRY FILTER
            if country_filter and row_country != country_filter.lower():
                continue

            industry = (row.get('industry', '') or '').strip().lower()
            name = (row.get('name', '') or '').strip()

            if not name:
                skipped += 1
                continue

            # Pre-filter: check if industry is SEPC-relevant
            domain = SEPC_INDUSTRY_MAP.get(industry)
            if not domain and not is_sepc_relevant(industry):
                skipped += 1
                continue

            # If not in direct map, classify via rule-based
            if not domain:
                result = classify_company(name, '', industry)
                domain = result.get('domain')
                if not domain:
                    skipped += 1
                    continue

            # Map CSV columns to schema
            founded_year = None
            try:
                fy = row.get('year founded', '')
                if fy and fy != '':
                    founded_year = int(float(fy))
            except (ValueError, TypeError):
                pass

            linkedin_url = row.get('linkedin url', '') or ''
            if linkedin_url and not linkedin_url.startswith('http'):
                linkedin_url = f'https://{linkedin_url}'

            website_url = (row.get('domain', '') or '').strip()
            if website_url and not website_url.startswith('http'):
                website_url = f'https://{website_url}'

            company_doc = {
                'name': name.title(),
                'websiteUrl': website_url,
                'linkedinUrl': linkedin_url,
                'domain': domain,
                'foundedYear': founded_year,
                'country': (row.get('country', '') or '').strip().title(),
                'city': (row.get('locality', '') or '').split(',')[0].strip().title() if row.get('locality') else None,
                'employeeCount': row.get('current employee estimate', ''),
                'enrichmentStatus': 'minimal',
                'freshnessScore': 0,
                'isActive': None,
                'tier': None,
                'dataSource': 'CSV Import (Pre-filtered)',
            }

            # Estimate tier from employee count
            try:
                emp = int(company_doc['employeeCount']) if company_doc['employeeCount'] else 0
                if emp >= 1000:
                    company_doc['tier'] = 1
                elif emp >= 100:
                    company_doc['tier'] = 2
                else:
                    company_doc['tier'] = 3
            except (ValueError, TypeError):
                size = (row.get('size range', '') or '').lower()
                if '10001' in size or '5001' in size:
                    company_doc['tier'] = 1
                elif '1001' in size or '501' in size or '201' in size:
                    company_doc['tier'] = 2
                else:
                    company_doc['tier'] = 3

            batch.append(company_doc)

            if len(batch) >= batch_size:
                _insert_batch(collection, batch)
                imported += len(batch)
                print(f"  📊 Imported: {imported:,} | Skipped: {skipped:,}")
                batch = []

                if max_records and imported >= max_records:
                    print(f"  ⚡ Reached max_records limit ({max_records})")
                    break

    # Final batch
    if batch:
        _insert_batch(collection, batch)
        imported += len(batch)

    print(f"\n{'='*60}")
    print(f"  ✅ IMPORT COMPLETE")
    print(f"     Imported: {imported:,}")
    print(f"     Skipped (non-SEPC): {skipped:,}")
    print(f"     Database: {db.name}")
    print(f"{'='*60}\n")

    client.close()
    return imported


def _insert_batch(collection, batch):
    """Upsert batch by name to avoid duplicates."""
    from pymongo import UpdateOne
    operations = []
    for doc in batch:
        operations.append(
            UpdateOne(
                {'name': doc['name']},
                {'$setOnInsert': doc},
                upsert=True
            )
        )
    if operations:
        collection.bulk_write(operations, ordered=False)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Import CSV to MongoDB (SEPC-filtered)')
    parser.add_argument('--csv', required=True, help='Path to CSV file')
    parser.add_argument('--max', type=int, default=None, help='Max records to import')
    parser.add_argument('--batch', type=int, default=500, help='Batch size')
    parser.add_argument('--country', type=str, default=None, help='Filter by country (e.g. india)')
    args = parser.parse_args()

    import_csv_to_mongo(args.csv, batch_size=args.batch, max_records=args.max, country_filter=args.country)
