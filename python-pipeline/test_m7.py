import sys
import os
import json
from dotenv import load_dotenv

# Make sure the enrichment package is accessible
sys.path.append("c:/Users/aanya/projects/leadverification/python-pipeline")

load_dotenv("c:/Users/aanya/projects/leadverification/python-pipeline/.env")
from enrichment.module_7_documents import audit_documents

if __name__ == "__main__":
    print("Testing Module 7: Documents")
    docs = audit_documents("Reliance Industries Limited", "ril.com")
    print("\nResult:")
    print(json.dumps(docs, indent=2))
