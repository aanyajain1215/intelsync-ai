import requests, os, json
from dotenv import load_dotenv
load_dotenv('.env')
url = "https://google.serper.dev/search"
headers = {
    'X-API-KEY': os.environ.get('SERPER_API_KEY', ''),
    'Content-Type': 'application/json'
}
payload = {
    "q": "site:linkedin.com/in/ \"Krithi Krithivasan\" \"Tata Consultancy Services\"",
    "num": 5
}
try:
    response = requests.post(url, headers=headers, json=payload)
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(e)
