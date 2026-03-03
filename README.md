# AI-Powered Loan Decision Engine with XAI

> Full-stack credit risk scoring system for Indian lending — powered by XGBoost, SHAP, LIME, and Rule-based explanations. Every decision comes with a reason.

---

## Project Structure

```
Credit_Risk_Model/
├── credit_risk_model.py        ← ML model + SHAP/LIME/Rules engine + CSV export
├── api.py                      ← FastAPI REST server
├── requirements.txt            ← Python dependencies
├── credit_risk_dataset.csv     ← Auto-generated synthetic dataset (2000 rows)
├── creditiq/                   ← React frontend app
│   └── src/
│       └── App.js              ← Full UI (copy CreditIQ_Frontend.jsx here)
└── README.md
```

---

## How to Run (Every Time)

Open **two terminals** side by side:

**Terminal 1 — Backend**
```powershell
cd C:\...\Credit-Risk-XAI

# Activate virtual environment
.venv\Scripts\activate

# Start API server
uvicorn api:app --reload --port 8000
```

**Terminal 2 — Frontend**
```powershell
cd C:\...\Credit-Risk-XAI\creditiq

# Install node modules (only needed after cloning)
npm install

# Start React app
npm start
```

Then open your browser:
- **UI** → http://localhost:3000
- **API Swagger Docs** → http://localhost:8000/docs

---

## First-Time Setup

### Step 1 — Clone the repository
```powershell
git clone https://github.com/saikrishna64/Credit-Risk-XAI.git
cd Credit-Risk-XAI
```

### Step 2 — Create and activate Python virtual environment
```powershell
# Create virtual environment
python -m venv .venv

# Activate it (Windows)
.venv\Scripts\activate

# You should see (.venv) at the start of your terminal prompt
```

### Step 3 — Install Python dependencies
```powershell
pip install -r requirements.txt
```

### Step 4 — Test the model (optional)
```powershell
# Generates credit_risk_dataset.csv and prints sample predictions
python credit_risk_model.py
```

### Step 5 — Install frontend dependencies
```powershell
cd creditiq
npm install
cd ..
```

### Step 6 — Run the project (two terminals)

**Terminal 1 — Backend**
```powershell
cd Credit-Risk-XAI
.venv\Scripts\activate
uvicorn api:app --reload --port 8000
```

**Terminal 2 — Frontend**
```powershell
cd Credit-Risk-XAI\creditiq
npm start
```

> **Note:** Every time you open a new terminal for the backend, you must activate the virtual environment first with `.venv\Scripts\activate`. You will see `(.venv)` at the start of the prompt when it is active.

---

## Features

### UI — Luxury Fintech Design
- **Indian Rupee (₹) formatting** — values shown as ₹6.00 L, ₹50K, ₹2.50 Cr
- **CIBIL credit score scale** — 300 to 900 (Indian standard)
- **Animated ring gauge** — default probability with smooth easing animation
- **Animated number counters** — approval/default % counts up on each result
- **Staggered bar animations** — SHAP and LIME bars slide in sequentially
- **Live API indicator** — green pulsing dot confirms backend connection
- **3 XAI tabs** — SHAP Analysis, LIME Breakdown, Decision Rules
- **Improvement tips panel** — shown on rejection with actionable advice
- **INR amount scaling** — UI values in ₹ are auto-converted to model's USD scale (÷83)

### ML Model
| Property | Detail |
|----------|--------|
| Algorithm | Gradient Boosting Classifier (XGBoost-style) |
| Dataset | Synthetic Indian credit data — 2000 samples |
| Performance | ~0.85 AUC-ROC |
| Default rate | ~31% (mirrors real-world imbalance) |
| Input features | 14 features across 4 categories |

### XAI Methods
| Method | What it explains |
|--------|-----------------|
| **SHAP** | Exact contribution of each feature to the decision (global + local waterfall) |
| **LIME** | Local linear approximation around the specific applicant's data point |
| **Decision Rules** | Transparent business logic — auditable, RBI-compliant, human-readable |

---

## Input Features

### Demographics
| Feature | Range | Description |
|---------|-------|-------------|
| `age` | 18–75 | Applicant age |
| `income` | ₹1L–₹1Cr | Annual income |

### Employment
| Feature | Values | Description |
|---------|--------|-------------|
| `employment_type` | 0=Salaried, 1=Self-employed, 2=Part-time, 3=Unemployed | Employment status |
| `employment_years` | 0–40 | Years at current/last job |

### Credit History
| Feature | Range | Description |
|---------|-------|-------------|
| `credit_score` | 300–900 | CIBIL credit score |
| `num_credit_accounts` | 0–15 | Open credit accounts |
| `num_late_payments` | 0–10 | Late payment count on record |
| `credit_history_years` | 0–30 | Length of credit history |

### Financial Position
| Feature | Range | Description |
|---------|-------|-------------|
| `existing_debt` | ₹0–₹50L | Total current debt |
| `savings_balance` | ₹0–₹50L | Savings and liquid assets |
| `dti_ratio` | 0–100% | Debt-to-income ratio |

### Loan Request
| Feature | Values | Description |
|---------|--------|-------------|
| `loan_amount` | ₹10K–₹1Cr | Requested loan amount |
| `loan_term_months` | 12/24/36/48/60/84 | Repayment period |
| `loan_purpose` | 0=Home, 1=Vehicle, 2=Education, 3=Personal, 4=Business | Purpose of loan |

---

## API Reference

**POST** `/predict`

The frontend sends INR values divided by 83 (USD conversion) to match the model's training distribution.

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 30,
    "income": 7229,
    "employment_years": 5,
    "employment_type": 0,
    "credit_score": 650,
    "num_credit_accounts": 4,
    "num_late_payments": 1,
    "credit_history_years": 7,
    "existing_debt": 2410,
    "loan_amount": 6024,
    "loan_term_months": 36,
    "dti_ratio": 0.32,
    "loan_purpose": 0,
    "savings_balance": 1807
  }'
```

**Response fields:**
| Field | Type | Description |
|-------|------|-------------|
| `decision` | string | `APPROVED` or `REJECTED` |
| `probability_default` | float | Default probability 0–1 |
| `probability_approved` | float | Approval probability 0–1 |
| `risk_tier` | string | LOW / MODERATE / HIGH / VERY HIGH RISK |
| `shap_all` | array | All 14 features with SHAP values |
| `shap_top_negative` | array | Top 3 risk-increasing features |
| `shap_top_positive` | array | Top 3 risk-reducing features |
| `lime_contributions` | array | Local linear explanation conditions + weights |
| `rule_explanations` | array | Business rule audit trail with severity |
| `summary_message` | string | Plain English decision summary |

**Other endpoints:**
- `GET /health` — API status check
- `GET /meta` — Feature metadata (employment types, loan purposes)
- `GET /docs` — Interactive Swagger UI

---

## Sample Decision Output

```json
{
  "decision": "REJECTED",
  "risk_tier": "HIGH RISK",
  "probability_default": 0.73,
  "probability_approved": 0.27,
  "summary_message": "Application REJECTED (HIGH RISK). Primary concerns: Credit Score, Debt-to-Income Ratio. Default probability: 73.0%.",
  "rule_explanations": [
    {
      "factor": "Credit Score",
      "value": "540",
      "severity": "HIGH",
      "impact": "NEGATIVE",
      "explanation": "Score of 540 is below the 580 minimum threshold — indicates high default risk."
    },
    {
      "factor": "Debt-to-Income Ratio",
      "value": "62%",
      "severity": "HIGH",
      "impact": "NEGATIVE",
      "explanation": "DTI of 62% is critically high — over half of income goes to debt repayment."
    }
  ]
}
```

---

## Dataset — `credit_risk_dataset.csv`

Auto-generated every time you run `python credit_risk_model.py`.

| Column | Type | Description |
|--------|------|-------------|
| age | int | Applicant age |
| income | int | Annual income (USD scale for model) |
| employment_years | float | Years employed |
| employment_type | int | 0–3 (see table above) |
| credit_score | int | 300–850 |
| num_credit_accounts | int | Open accounts |
| num_late_payments | int | Late payments on record |
| credit_history_years | float | Credit history length |
| existing_debt | int | Current total debt |
| loan_amount | int | Loan requested |
| loan_term_months | int | Repayment term |
| dti_ratio | float | Debt-to-income ratio |
| loan_purpose | int | 0–4 (see table above) |
| savings_balance | int | Liquid savings |
| **default** | **int** | **TARGET: 1 = Default (Rejected), 0 = No Default (Approved)** |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Model | scikit-learn GradientBoostingClassifier |
| SHAP | `shap` TreeExplainer |
| LIME | `lime` LimeTabularExplainer |
| API | FastAPI + Uvicorn |
| Frontend | React (Create React App) |
| Styling | Inline CSS — luxury gold/dark fintech theme |
| Currency | Indian Rupee (₹) with lakh/crore formatting |

## 🌐 Live Demo

Experience the application live — no setup required, accessible from any device.

| | Link |
|--|------|
| 🚀 Live App | https://ai-powered-loan-decision-engine-wit.vercel.app |
| 💻 GitHub | [saikrishna64/AI-Powered_Loan_Decision_Engine_with_XAI](https://github.com/saikrishna64/AI-Powered_Loan_Decision_Engine_with_XAI) |

> Enter any applicant's financial details and instantly see the loan decision along with full XAI reasoning — powered by SHAP, LIME, and Rule-based explanations. No installation needed.
