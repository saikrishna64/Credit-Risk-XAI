"""
Credit Risk Scoring with Explainable AI (XAI)
==============================================
Model: XGBoost Classifier
XAI Methods: SHAP, LIME, Decision Path (Rule-based)
Dataset: Synthetic German Credit-style dataset
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score
import shap
import lime
import lime.lime_tabular
import warnings
warnings.filterwarnings('ignore')

# ─────────────────────────────────────────
#  1. SYNTHETIC DATASET GENERATION
# ─────────────────────────────────────────

np.random.seed(42)

def generate_credit_dataset(n=2000):
    """Generate a realistic synthetic credit dataset."""
    
    # Demographics
    age = np.random.normal(38, 12, n).clip(18, 75).astype(int)
    
    # Employment
    employment_years = np.random.exponential(5, n).clip(0, 40)
    employment_type = np.random.choice([0, 1, 2, 3], n, p=[0.5, 0.2, 0.2, 0.1])
    # 0=employed, 1=self-employed, 2=part-time, 3=unemployed
    
    # Income (correlated with age, employment)
    base_income = 30000 + age * 800 + employment_years * 1200
    income = (base_income + np.random.normal(0, 10000, n)).clip(10000, 250000)
    
    # Credit history
    credit_score = np.random.normal(650, 100, n).clip(300, 850).astype(int)
    num_credit_accounts = np.random.poisson(4, n).clip(0, 15)
    num_late_payments = np.random.poisson(1, n).clip(0, 10)
    credit_history_years = np.random.normal(8, 5, n).clip(0, 30)
    
    # Debt metrics
    existing_debt = np.random.exponential(15000, n).clip(0, 200000)
    loan_amount = np.random.normal(25000, 15000, n).clip(1000, 100000)
    loan_term_months = np.random.choice([12, 24, 36, 48, 60, 84], n)
    
    # Monthly debt-to-income ratio
    monthly_income = income / 12
    monthly_debt_payment = (existing_debt * 0.02) + (loan_amount / loan_term_months)
    dti_ratio = (monthly_debt_payment / monthly_income).clip(0, 2)
    
    # Purpose
    loan_purpose = np.random.choice([0, 1, 2, 3, 4], n, p=[0.3, 0.25, 0.2, 0.15, 0.1])
    # 0=home, 1=car, 2=education, 3=personal, 4=business
    
    # Savings
    savings_balance = np.random.exponential(10000, n).clip(0, 500000)
    
    # Build label (default = 1, no default = 0)
    # Based on realistic risk factors
    risk_score = (
        - (credit_score - 650) * 0.008          # credit score
        + dti_ratio * 3.5                         # high DTI = risk
        - np.log1p(income / 1000) * 0.4          # higher income = lower risk
        + (employment_type == 3) * 2.0            # unemployed = high risk
        + num_late_payments * 0.3                 # late payments = risk
        - employment_years * 0.05                 # more experience = lower risk
        - np.log1p(savings_balance / 1000) * 0.2 # savings = lower risk
        + (age < 25) * 0.5                        # young = slightly higher risk
        + np.random.normal(0, 0.5, n)             # noise
    )
    
    prob_default = 1 / (1 + np.exp(-risk_score))
    default = (np.random.random(n) < prob_default).astype(int)
    
    df = pd.DataFrame({
        'age': age,
        'income': income.astype(int),
        'employment_years': employment_years.round(1),
        'employment_type': employment_type,
        'credit_score': credit_score,
        'num_credit_accounts': num_credit_accounts,
        'num_late_payments': num_late_payments,
        'credit_history_years': credit_history_years.round(1),
        'existing_debt': existing_debt.astype(int),
        'loan_amount': loan_amount.astype(int),
        'loan_term_months': loan_term_months,
        'dti_ratio': dti_ratio.round(3),
        'loan_purpose': loan_purpose,
        'savings_balance': savings_balance.astype(int),
        'default': default
    })
    
    return df


# ─────────────────────────────────────────
#  2. MODEL TRAINING
# ─────────────────────────────────────────

FEATURE_NAMES = [
    'age', 'income', 'employment_years', 'employment_type',
    'credit_score', 'num_credit_accounts', 'num_late_payments',
    'credit_history_years', 'existing_debt', 'loan_amount',
    'loan_term_months', 'dti_ratio', 'loan_purpose', 'savings_balance'
]

FEATURE_DISPLAY_NAMES = {
    'age': 'Age',
    'income': 'Annual Income',
    'employment_years': 'Years Employed',
    'employment_type': 'Employment Type',
    'credit_score': 'Credit Score',
    'num_credit_accounts': 'Credit Accounts',
    'num_late_payments': 'Late Payments',
    'credit_history_years': 'Credit History (Years)',
    'existing_debt': 'Existing Debt',
    'loan_amount': 'Loan Amount',
    'loan_term_months': 'Loan Term (Months)',
    'dti_ratio': 'Debt-to-Income Ratio',
    'loan_purpose': 'Loan Purpose',
    'savings_balance': 'Savings Balance'
}

EMPLOYMENT_TYPES = {0: 'Full-time Employed', 1: 'Self-employed', 2: 'Part-time', 3: 'Unemployed'}
LOAN_PURPOSES = {0: 'Home Improvement', 1: 'Vehicle', 2: 'Education', 3: 'Personal', 4: 'Business'}


def train_model(df):
    X = df[FEATURE_NAMES]
    y = df['default']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)
    
    # XGBoost-style Gradient Boosting
    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42
    )
    model.fit(X_train_sc, y_train)
    
    # Evaluation
    y_pred = model.predict(X_test_sc)
    y_prob = model.predict_proba(X_test_sc)[:, 1]
    auc = roc_auc_score(y_test, y_prob)
    
    print(f"\n{'='*50}")
    print(f"  MODEL PERFORMANCE")
    print(f"{'='*50}")
    print(f"  AUC-ROC Score: {auc:.4f}")
    print(classification_report(y_test, y_pred, target_names=['Approved', 'Rejected']))
    
    return model, scaler, X_train_sc, X_train


# ─────────────────────────────────────────
#  3. XAI EXPLAINERS
# ─────────────────────────────────────────

def build_shap_explainer(model, X_train_sc):
    """Build SHAP TreeExplainer."""
    explainer = shap.TreeExplainer(model)
    return explainer


def build_lime_explainer(X_train_sc, X_train_df):
    """Build LIME tabular explainer."""
    explainer = lime.lime_tabular.LimeTabularExplainer(
        X_train_sc,
        feature_names=FEATURE_NAMES,
        class_names=['Approved', 'Rejected'],
        mode='classification',
        random_state=42
    )
    return explainer


# ─────────────────────────────────────────
#  4. PREDICTION + EXPLANATION ENGINE
# ─────────────────────────────────────────

def get_decision_rules(applicant, credit_score, dti_ratio, income, 
                        employment_type, num_late_payments, savings_balance):
    """Rule-based explanation (transparent business logic)."""
    rules = []
    
    # Credit score rules
    if credit_score < 580:
        rules.append({
            'factor': 'Credit Score',
            'value': f'{credit_score}',
            'impact': 'NEGATIVE',
            'severity': 'HIGH',
            'explanation': f'Credit score of {credit_score} is below minimum threshold of 580. '
                           f'Indicates high risk of default based on payment history.'
        })
    elif credit_score < 650:
        rules.append({
            'factor': 'Credit Score',
            'value': f'{credit_score}',
            'impact': 'NEGATIVE',
            'severity': 'MEDIUM',
            'explanation': f'Credit score of {credit_score} is fair but below ideal range (650+).'
        })
    else:
        rules.append({
            'factor': 'Credit Score',
            'value': f'{credit_score}',
            'impact': 'POSITIVE',
            'severity': 'LOW',
            'explanation': f'Good credit score of {credit_score} suggests responsible credit behavior.'
        })
    
    # DTI rules
    if dti_ratio > 0.5:
        rules.append({
            'factor': 'Debt-to-Income Ratio',
            'value': f'{dti_ratio:.1%}',
            'impact': 'NEGATIVE',
            'severity': 'HIGH',
            'explanation': f'DTI ratio of {dti_ratio:.1%} is critically high. '
                           f'Over 50% of income goes toward debt payments, leaving little cushion.'
        })
    elif dti_ratio > 0.35:
        rules.append({
            'factor': 'Debt-to-Income Ratio',
            'value': f'{dti_ratio:.1%}',
            'impact': 'NEGATIVE',
            'severity': 'MEDIUM',
            'explanation': f'DTI ratio of {dti_ratio:.1%} exceeds recommended 35% limit.'
        })
    else:
        rules.append({
            'factor': 'Debt-to-Income Ratio',
            'value': f'{dti_ratio:.1%}',
            'impact': 'POSITIVE',
            'severity': 'LOW',
            'explanation': f'Healthy DTI ratio of {dti_ratio:.1%} — well within acceptable range.'
        })
    
    # Employment rules
    if employment_type == 3:
        rules.append({
            'factor': 'Employment Status',
            'value': 'Unemployed',
            'impact': 'NEGATIVE',
            'severity': 'HIGH',
            'explanation': 'Unemployment significantly increases default risk due to lack of stable income.'
        })
    elif employment_type == 2:
        rules.append({
            'factor': 'Employment Status',
            'value': 'Part-time',
            'impact': 'NEGATIVE',
            'severity': 'MEDIUM',
            'explanation': 'Part-time employment provides less income stability than full-time roles.'
        })
    
    # Late payments
    if num_late_payments >= 3:
        rules.append({
            'factor': 'Late Payment History',
            'value': f'{num_late_payments} late payments',
            'impact': 'NEGATIVE',
            'severity': 'HIGH',
            'explanation': f'{num_late_payments} late payments on record indicate unreliable repayment behavior.'
        })
    elif num_late_payments > 0:
        rules.append({
            'factor': 'Late Payment History',
            'value': f'{num_late_payments} late payment(s)',
            'impact': 'NEGATIVE',
            'severity': 'LOW',
            'explanation': f'{num_late_payments} minor late payment(s) noted.'
        })
    
    # Savings
    if savings_balance < 1000:
        rules.append({
            'factor': 'Savings Balance',
            'value': f'${savings_balance:,}',
            'impact': 'NEGATIVE',
            'severity': 'MEDIUM',
            'explanation': 'Very low savings provide no financial buffer in case of income disruption.'
        })
    elif savings_balance > 20000:
        rules.append({
            'factor': 'Savings Balance',
            'value': f'${savings_balance:,}',
            'impact': 'POSITIVE',
            'severity': 'LOW',
            'explanation': f'Strong savings of ${savings_balance:,} demonstrate financial discipline and provide safety net.'
        })
    
    return rules


def predict_with_explanation(applicant_data: dict, model, scaler, 
                               shap_explainer, lime_explainer, X_train_sc):
    """
    Full prediction pipeline with SHAP, LIME, and Rule-based explanations.
    
    applicant_data keys: age, income, employment_years, employment_type,
                         credit_score, num_credit_accounts, num_late_payments,
                         credit_history_years, existing_debt, loan_amount,
                         loan_term_months, dti_ratio, loan_purpose, savings_balance
    """
    
    # Prepare input
    x = pd.DataFrame([applicant_data])[FEATURE_NAMES]
    x_scaled = scaler.transform(x)
    
    # Prediction
    prob_default = model.predict_proba(x_scaled)[0][1]
    prob_approved = 1 - prob_default
    decision = 'REJECTED' if prob_default > 0.5 else 'APPROVED'
    
    # Risk tier
    if prob_default < 0.2:
        risk_tier = 'LOW RISK'
    elif prob_default < 0.4:
        risk_tier = 'MODERATE RISK'
    elif prob_default < 0.6:
        risk_tier = 'HIGH RISK'
    else:
        risk_tier = 'VERY HIGH RISK'
    
    # ── SHAP Explanation ──
    shap_values = shap_explainer.shap_values(x_scaled)
    # GradientBoostingClassifier returns a single 2D array (not a list).
    # RandomForest returns a list [class0_array, class1_array].
    # In both cases we want the values for class 1 (default), row 0.
    if isinstance(shap_values, list):
        sv = shap_values[1][0]   # list → take class-1 array, first row
    else:
        sv = shap_values[0]      # single array → first row

    shap_contributions = []
    for i, feat in enumerate(FEATURE_NAMES):
        shap_contributions.append({
            'feature': feat,
            'display_name': FEATURE_DISPLAY_NAMES[feat],
            'value': float(applicant_data[feat]),
            'shap_value': float(sv[i]),
            'impact': 'NEGATIVE' if sv[i] > 0 else 'POSITIVE'
        })

    shap_contributions.sort(key=lambda x: abs(x['shap_value']), reverse=True)

    # ── LIME Explanation ──
    lime_exp = lime_explainer.explain_instance(
        x_scaled[0], model.predict_proba, num_features=6, num_samples=500
    )
    lime_contributions = []
    for feat_str, weight in lime_exp.as_list():
        lime_contributions.append({
            'feature_condition': feat_str,
            'weight': float(weight),
            'impact': 'NEGATIVE' if weight > 0 else 'POSITIVE'
        })

    # ── Rule-based Explanation ──
    rule_explanations = get_decision_rules(
        applicant_data,
        applicant_data['credit_score'],
        applicant_data['dti_ratio'],
        applicant_data['income'],
        applicant_data['employment_type'],
        applicant_data['num_late_payments'],
        applicant_data['savings_balance']
    )

    # ── Summary: Top reasons ──
    top_negative = [s for s in shap_contributions if s['impact'] == 'NEGATIVE'][:3]
    top_positive = [s for s in shap_contributions if s['impact'] == 'POSITIVE'][:3]

    result = {
        'decision': decision,
        'probability_default': round(prob_default, 4),
        'probability_approved': round(prob_approved, 4),
        'risk_tier': risk_tier,
        'credit_score_computed': int(prob_approved * 1000),
        'shap': {
            'all_contributions': shap_contributions,
            'top_negative_factors': top_negative,
            'top_positive_factors': top_positive,
            'base_value': float(
                shap_explainer.expected_value[1]
                if isinstance(shap_explainer.expected_value, (list, np.ndarray))
                   and np.asarray(shap_explainer.expected_value).shape[0] > 1
                else np.asarray(shap_explainer.expected_value).ravel()[0]
            )
        },
        'lime': {
            'contributions': lime_contributions,
            'intercept': float(lime_exp.intercept[1])
        },
        'rules': rule_explanations,
        'applicant': applicant_data
    }

    return result


def format_explanation_report(result):
    """Print a human-readable explanation report."""
    d = result

    print(f"\n{'═'*60}")
    print(f"  CREDIT DECISION REPORT")
    print(f"{'═'*60}")
    print(f"  Decision:     {d['decision']}")
    print(f"  Risk Tier:    {d['risk_tier']}")
    print(f"  Default Prob: {d['probability_default']:.1%}")
    print(f"  Approval Prob:{d['probability_approved']:.1%}")

    print(f"\n  📊 TOP FACTORS (SHAP Analysis)")
    print(f"  {'─'*50}")
    print(f"  ▼ Factors HURTING your application:")
    for f in d['shap']['top_negative_factors']:
        print(f"     • {f['display_name']}: {f['value']} (impact: +{f['shap_value']:.3f})")

    print(f"\n  ▲ Factors HELPING your application:")
    for f in d['shap']['top_positive_factors']:
        print(f"     • {f['display_name']}: {f['value']} (impact: {f['shap_value']:.3f})")

    print(f"\n  📋 RULE-BASED REASONS")
    print(f"  {'─'*50}")
    for rule in d['rules']:
        icon = '❌' if rule['impact'] == 'NEGATIVE' else '✅'
        print(f"  {icon} [{rule['severity']}] {rule['factor']}: {rule['value']}")
        print(f"     → {rule['explanation']}")

    print(f"\n  🔍 LIME LOCAL EXPLANATION")
    print(f"  {'─'*50}")
    for lime_item in d['lime']['contributions'][:5]:
        arrow = '↑ risk' if lime_item['impact'] == 'NEGATIVE' else '↓ risk'
        print(f"  • {lime_item['feature_condition']}: {lime_item['weight']:+.4f} ({arrow})")

    print(f"\n{'═'*60}\n")


# ─────────────────────────────────────────
#  5. MAIN DEMO
# ─────────────────────────────────────────

if __name__ == '__main__':
    print("Generating dataset...")
    df = generate_credit_dataset(2000)
    print(f"Dataset shape: {df.shape}")
    print(f"Default rate: {df['default'].mean():.1%}")

    print("\nTraining model...")
    model, scaler, X_train_sc, X_train_df = train_model(df)

    print("\nBuilding XAI explainers (SHAP + LIME)...")
    shap_explainer = build_shap_explainer(model, X_train_sc)
    lime_explainer = build_lime_explainer(X_train_sc, X_train_df)
    print("✅ Explainers ready!")

    # ── Test Case 1: Risky applicant (likely rejected) ──
    risky_applicant = {
        'age': 23,
        'income': 28000,
        'employment_years': 0.5,
        'employment_type': 2,        # part-time
        'credit_score': 540,
        'num_credit_accounts': 2,
        'num_late_payments': 4,
        'credit_history_years': 1.5,
        'existing_debt': 18000,
        'loan_amount': 15000,
        'loan_term_months': 36,
        'dti_ratio': 0.62,
        'loan_purpose': 3,           # personal
        'savings_balance': 300
    }

    print("\n--- Test Case 1: Risky Applicant ---")
    result1 = predict_with_explanation(
        risky_applicant, model, scaler,
        shap_explainer, lime_explainer, X_train_sc
    )
    format_explanation_report(result1)

    # ── Test Case 2: Strong applicant (likely approved) ──
    strong_applicant = {
        'age': 42,
        'income': 95000,
        'employment_years': 12.0,
        'employment_type': 0,        # full-time
        'credit_score': 760,
        'num_credit_accounts': 6,
        'num_late_payments': 0,
        'credit_history_years': 15.0,
        'existing_debt': 8000,
        'loan_amount': 20000,
        'loan_term_months': 60,
        'dti_ratio': 0.18,
        'loan_purpose': 0,           # home
        'savings_balance': 45000
    }

    print("\n--- Test Case 2: Strong Applicant ---")
    result2 = predict_with_explanation(
        strong_applicant, model, scaler,
        shap_explainer, lime_explainer, X_train_sc
    )
    format_explanation_report(result2)