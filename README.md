# IntelSync AI — SEPC Lead Verification System

> **Dynamic Market Intelligence & Lead Verification Platform**  
> Built for the Services Export Promotion Council (SEPC), Ministry of Commerce & Industry, Government of India

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://mongodb.com/atlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

IntelSync AI is an AI-powered lead verification and market intelligence platform that automatically enriches company profiles across **6 SEPC strategic service export domains**. It combines multi-source web discovery, LLM-based extraction (Groq + Gemini), and financial document analysis to produce verified, enriched company intelligence reports.

### Key Capabilities

- 🔍 **7-Module Enrichment Pipeline** — automated company profiling from identity verification to financial document discovery
- 🤖 **Hybrid AI Classification** — LLM + rule-based domain classification for service sector companies
- 👔 **Leadership Intelligence** — executive discovery with LinkedIn profile verification
- 📊 **Financial Tiering** — revenue-based risk scoring and financial document fetching
- 📡 **Signal Detection** — news monitoring, regulatory alerts, and market signal aggregation
- 🔄 **Staleness Tracking** — automatic freshness scoring and re-enrichment scheduling
- 🛡️ **Role-Based Access** — JWT-authenticated multi-user platform (Admin / Staff)

---

## Architecture

```
leadverification/
├── backend/                    # Express.js REST API + MongoDB
│   ├── models/                 # Mongoose schemas (Company, User, Alert)
│   ├── routes/                 # REST endpoints (companies, auth, analytics, freshness)
│   ├── middleware/             # JWT auth middleware
│   ├── dataset/                # Source CSV (gitignored — see Setup)
│   ├── seed_admin.js           # Seeds default admin account
│   └── index.js                # Server entry point (port 5000)
│
├── frontend/                   # Vite + React + Tailwind v4
│   └── src/
│       ├── pages/              # Dashboard, CompanyDetail, Login, Register, etc.
│       ├── components/         # Reusable UI components
│       ├── context/            # AuthContext
│       ├── hooks/              # Custom React hooks
│       └── services/           # Axios API client
│
└── python-pipeline/            # Python enrichment engine + Node.js bridge
    ├── enrichment/
    │   ├── module_1_identity.py      # Domain validation, business registry lookup
    │   ├── module_2_status.py        # Operational status & founding year
    │   ├── module_3_contact.py       # Contact info extraction
    │   ├── module_4_leadership.py    # C-suite & VP discovery + LinkedIn verification
    │   ├── module_5_financials.py    # Revenue tiering & financial analysis
    │   ├── module_6_signals.py       # News signals & risk detection
    │   ├── module_7_documents.py     # Financial document (PDF) discovery
    │   ├── enrich_company.py         # Orchestration: runs all 7 modules in parallel
    │   ├── import_to_mongo.py        # CSV ingestion script
    │   └── llm_client.py             # Groq / Gemini LLM abstraction
    ├── ai/
    │   └── hybrid_classifier.py      # Service-sector domain classifier
    ├── server.js                     # Node.js bridge server (port 8000)
    └── requirements.txt
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB Atlas account (free tier works)
- API keys: [Groq](https://console.groq.com), [Gemini](https://aistudio.google.com/app/apikey), [Serper](https://serper.dev)

### 1. Clone & Configure

```bash
git clone https://github.com/<your-username>/leadverification.git
cd leadverification
```

Copy the example environment files and fill in your credentials:

```bash
# Backend
cp backend/.env.example backend/.env

# Python pipeline
cp python-pipeline/.env.example python-pipeline/.env
```

### 2. Backend

```bash
cd backend
npm install
node seed_admin.js      # Creates default admin account
node index.js           # Starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev             # Starts on http://localhost:5173
```

### 4. Python Enrichment Pipeline

```bash
cd python-pipeline
npm install             # Bridge server dependencies
pip install -r requirements.txt
node server.js          # Starts on http://localhost:8000
```

### 5. Import Dataset

```bash
# Place your companies CSV at backend/dataset/companies_sorted.csv
python python-pipeline/enrichment/import_to_mongo.py \
  --csv backend/dataset/companies_sorted.csv \
  --max 5000
```

---

## Environment Variables

### `backend/.env`

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for signing JWTs (use a strong random string) |
| `PORT` | Backend port (default: `5000`) |
| `PYTHON_API_URL` | Python bridge URL (default: `http://localhost:8000/enrich`) |

### `python-pipeline/.env`

| Variable | Description |
|---|---|
| `MONGO_URI` | Same MongoDB Atlas connection string |
| `GROQ_API_KEY` | Groq Cloud API key (LLM inference) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GOOGLE_KG_API_KEY` | Google Knowledge Graph API key |
| `SERPER_API_KEY` | Serper.dev web search API key |

See `.env.example` files in each directory for templates.

---

## Enrichment Pipeline — Module Reference

| Module | Purpose |
|---|---|
| **M1 — Identity** | Domain validation, business registry lookup, SEPC sector classification |
| **M2 — Status** | Operational status detection, founding year extraction |
| **M3 — Contact** | Phone, email, address extraction via multi-source scraping |
| **M4 — Leadership** | C-suite / VP / Director discovery with LinkedIn URL verification |
| **M5 — Financials** | Revenue tiering, valuation estimates, financial health scoring |
| **M6 — Signals** | News monitoring, regulatory signals, ESG flags, risk scoring |
| **M7 — Documents** | Annual reports, audit PDFs, regulatory filings discovery |

All 7 modules run **concurrently** via `enrich_company.py` using `asyncio`.

---

## SEPC 6 Strategic Service Export Domains

1. 🎬 Media and Entertainment
2. 🎓 Education
3. 🏥 Healthcare
4. ✈️ Tourism
5. 💰 Financial Services
6. 🏢 Consultancy Services

---

## Default Credentials

After running `seed_admin.js`:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@sepc.in` | `Admin@SEPC2026` |
| Staff | Open registration at `/register` | — |

> ⚠️ **Change the admin password immediately after first login in production.**

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## Team

| Name | Role |
|---|---|
| Ms. Aanya Jain | Full-Stack & Pipeline Lead |
| Mr. Abhijeet Bharate | Backend & Database |
| Mr. Apoorv Patil | Frontend & UI/UX |
| Mr. Arpit Verma | AI/ML & Enrichment |

**Third Year Computer Engineering, VIT Pune**  
**Mentor:** Dr. Abhay Sinha, Director General, SEPC

---

## License

This project is licensed under the [MIT License](LICENSE).
