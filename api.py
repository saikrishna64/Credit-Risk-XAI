"""
Credit Risk API — FastAPI Server
=================================
Run: uvicorn api:app --reload --port 8000

Endpoints:
  POST /predict   → Full XAI prediction
  GET  /health    → Health check
  GET  /docs      → Swagger UI
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import numpy as np
import pickle
import os

# Import our model module
from credit_risk_model import (
    generate_credit_dataset, train_model,
    build_shap_explainer, build_lime_explainer,
    predict_with_explanation, FEATURE_NAMES,
    EMPLOYMENT_TYPES, LOAN_PURPOSES
)

app = FastAPI(
    title="Credit Risk Scoring API with XAI",
    description="Loan approval decisions with SHAP, LIME, and Rule-based explanations",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ── Global model state ──
model_state = {}


@app.on_event("startup")
async def startup():
    """Train model on startup (or load from cache)."""
    print("🚀 Starting Credit Risk API...")
    print("📊 Generating dataset and training model...")
    
    df = generate_credit_dataset(2000)
    mdl, scaler, X_train_sc, X_train_df = train_model(df)
    shap_exp = build_shap_explainer(mdl, X_train_sc)
    lime_exp = build_lime_explainer(X_train_sc, X_train_df)
    
    model_state['model'] = mdl
    model_state['scaler'] = scaler
    model_state['X_train_sc'] = X_train_sc
    model_state['shap_explainer'] = shap_exp
    model_state['lime_explainer'] = lime_exp
    
    print("✅ Model and explainers ready!")


# ── Request/Response schemas ──

class ApplicantInput(BaseModel):
    age: int = Field(..., ge=18, le=80, example=35)
    income: float = Field(..., ge=0, example=65000)
    employment_years: float = Field(..., ge=0, example=8.0)
    employment_type: int = Field(..., ge=0, le=3, example=0,
        description="0=Full-time, 1=Self-employed, 2=Part-time, 3=Unemployed")
    credit_score: int = Field(..., ge=300, le=850, example=680)
    num_credit_accounts: int = Field(..., ge=0, example=4)
    num_late_payments: int = Field(..., ge=0, example=1)
    credit_history_years: float = Field(..., ge=0, example=10.0)
    existing_debt: float = Field(..., ge=0, example=12000)
    loan_amount: float = Field(..., ge=500, example=25000)
    loan_term_months: int = Field(..., example=36)
    dti_ratio: float = Field(..., ge=0, le=2, example=0.28)
    loan_purpose: int = Field(..., ge=0, le=4, example=0,
        description="0=Home, 1=Vehicle, 2=Education, 3=Personal, 4=Business")
    savings_balance: float = Field(..., ge=0, example=15000)


class PredictionResponse(BaseModel):
    decision: str
    probability_default: float
    probability_approved: float
    risk_tier: str
    shap_top_negative: list
    shap_top_positive: list
    shap_all: list
    lime_contributions: list
    rule_explanations: list
    summary_message: str


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": bool(model_state)}


@app.post("/predict", response_model=PredictionResponse)
async def predict(applicant: ApplicantInput):
    if not model_state:
        raise HTTPException(status_code=503, detail="Model not ready")
    
    applicant_dict = applicant.dict()
    
    result = predict_with_explanation(
        applicant_dict,
        model_state['model'],
        model_state['scaler'],
        model_state['shap_explainer'],
        model_state['lime_explainer'],
        model_state['X_train_sc']
    )
    
    # Build human summary
    decision = result['decision']
    risk = result['risk_tier']
    top_bad = result['shap']['top_negative_factors']
    top_good = result['shap']['top_positive_factors']
    
    if decision == 'REJECTED':
        reasons = ', '.join([f['display_name'] for f in top_bad[:2]])
        summary = (
            f"Application REJECTED ({risk}). "
            f"Primary concerns: {reasons}. "
            f"Default probability: {result['probability_default']:.1%}."
        )
    else:
        strengths = ', '.join([f['display_name'] for f in top_good[:2]])
        summary = (
            f"Application APPROVED ({risk}). "
            f"Key strengths: {strengths}. "
            f"Approval probability: {result['probability_approved']:.1%}."
        )
    
    return PredictionResponse(
        decision=result['decision'],
        probability_default=result['probability_default'],
        probability_approved=result['probability_approved'],
        risk_tier=result['risk_tier'],
        shap_top_negative=result['shap']['top_negative_factors'],
        shap_top_positive=result['shap']['top_positive_factors'],
        shap_all=result['shap']['all_contributions'],
        lime_contributions=result['lime']['contributions'],
        rule_explanations=result['rules'],
        summary_message=summary
    )


@app.get("/meta")
async def meta():
    """Return feature metadata for the UI."""
    return {
        "employment_types": EMPLOYMENT_TYPES,
        "loan_purposes": LOAN_PURPOSES,
        "features": FEATURE_NAMES
    }
