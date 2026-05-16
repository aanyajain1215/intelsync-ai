"""Seed a test company into MongoDB and return its ID."""
import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')
import pymongo, re

uri = os.environ.get('MONGO_URI', '')
client = pymongo.MongoClient(uri)
db = client.get_database()
col = db['companies']

name = sys.argv[1] if len(sys.argv) > 1 else 'Apollo Hospitals'

# Try to find existing
doc = col.find_one({'name': re.compile(f'^{re.escape(name)}', re.IGNORECASE)})
if doc:
    print(str(doc['_id']))
else:
    res = col.insert_one({
        'name': name,
        'enrichmentStatus': 'minimal',
        'freshnessScore': 0,
        'dataSource': 'Manual Test'
    })
    print(str(res.inserted_id))

client.close()
