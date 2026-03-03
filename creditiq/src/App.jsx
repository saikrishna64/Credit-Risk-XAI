import { useState, useRef } from "react";

const API_URL = "http://localhost:8000";

// Maps backend response → UI result shape
function mapApiResponse(data) {
  const shapContribs = (data.shap_all || []).map(s => ({
    feature: s.display_name,
    value: s.value,
    shap: s.shap_value,
    display: String(s.value),
  }));
  const lime = (data.lime_contributions || []).map(l => ({
    condition: l.feature_condition,
    weight: l.weight,
  }));
  const rules = (data.rule_explanations || []).map(r => ({
    factor: r.factor,
    value: r.value,
    severity: r.severity,
    impact: r.impact,
    reason: r.explanation,
  }));
  return {
    decision: data.decision,
    probDefault: data.probability_default,
    probApproved: data.probability_approved,
    riskTier: data.risk_tier,
    shapContribs,
    lime,
    rules,
    summaryMessage: data.summary_message,
  };
}

// ── Color tokens ──
const C = {
  bg: "#0a0e1a",
  surface: "#111827",
  card: "#161f30",
  border: "#1e2d45",
  accent: "#00d4ff",
  accentDim: "#0099bb",
  green: "#00e676",
  red: "#ff4444",
  orange: "#ff9800",
  yellow: "#ffd600",
  text: "#e8f0fe",
  muted: "#6b7fa3",
  shimmer: "#1a2540",
};

// ── Sub-components ──

function GaugeChart({ value }) {
  const pct = Math.min(Math.max(value, 0), 1);
  const angle = -135 + pct * 270;
  const color = pct < 0.3 ? C.green : pct < 0.5 ? C.yellow : pct < 0.7 ? C.orange : C.red;

  const polarToCartesian = (cx, cy, r, deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (cx, cy, r, start, end) => {
    const s = polarToCartesian(cx, cy, r, start);
    const e = polarToCartesian(cx, cy, r, end);
    const large = end - start <= 180 ? "0" : "1";
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needle = polarToCartesian(100, 100, 62, angle);

  return (
    <svg viewBox="0 0 200 140" style={{ width: "100%", maxWidth: 260 }}>
      {/* Background track */}
      <path d={describeArc(100, 100, 70, -135, 135)} fill="none" stroke={C.border} strokeWidth="12" strokeLinecap="round" />
      {/* Filled arc */}
      <path d={describeArc(100, 100, 70, -135, -135 + pct * 270)} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      {/* Needle */}
      <line x1="100" y1="100" x2={needle.x} y2={needle.y} stroke={C.text} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="100" cy="100" r="5" fill={C.text} />
      {/* Labels */}
      <text x="32" y="120" fill={C.green} fontSize="9" fontFamily="monospace">LOW</text>
      <text x="155" y="120" fill={C.red} fontSize="9" fontFamily="monospace">HIGH</text>
      <text x="100" y="125" fill={color} fontSize="22" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{(pct * 100).toFixed(0)}%</text>
      <text x="100" y="138" fill={C.muted} fontSize="8" fontFamily="monospace" textAnchor="middle">DEFAULT PROBABILITY</text>
    </svg>
  );
}

function ShapBar({ contrib }) {
  const max = 3.5;
  const pct = Math.min(Math.abs(contrib.shap) / max, 1) * 100;
  const isNeg = contrib.shap > 0; // positive shap = increases default risk
  const color = isNeg ? C.red : C.green;
  const dir = isNeg ? "right" : "left";

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11 }}>
        <span style={{ color: C.text, fontFamily: "monospace" }}>{contrib.feature}</span>
        <span style={{ color: C.muted, fontFamily: "monospace" }}>{contrib.display}</span>
      </div>
      <div style={{ position: "relative", height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          [dir]: "50%", width: `${pct / 2}%`,
          background: color,
          borderRadius: 4,
          boxShadow: `0 0 6px ${color}`,
          transition: "width 0.6s ease"
        }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: C.muted, opacity: 0.4 }} />
      </div>
      <div style={{ fontSize: 9, color: color, fontFamily: "monospace", textAlign: dir, marginTop: 1 }}>
        {isNeg ? "▲ increases risk" : "▼ reduces risk"} ({contrib.shap > 0 ? "+" : ""}{contrib.shap.toFixed(3)})
      </div>
    </div>
  );
}

function RuleCard({ rule }) {
  const isPos = rule.impact === "POSITIVE";
  const sevColor = rule.severity === "HIGH" ? C.red : rule.severity === "MEDIUM" ? C.orange : C.yellow;
  return (
    <div style={{
      background: isPos ? "rgba(0,230,118,0.05)" : "rgba(255,68,68,0.05)",
      border: `1px solid ${isPos ? "rgba(0,230,118,0.2)" : "rgba(255,68,68,0.2)"}`,
      borderRadius: 8, padding: "10px 14px", marginBottom: 10
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>{isPos ? "✅" : "❌"}</span>
          <span style={{ fontWeight: 700, fontSize: 12, color: C.text, fontFamily: "monospace" }}>{rule.factor}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: C.muted }}>{rule.value}</span>
          {!isPos && (
            <span style={{
              fontSize: 9, fontFamily: "monospace", fontWeight: 700,
              color: sevColor, border: `1px solid ${sevColor}`,
              borderRadius: 3, padding: "1px 5px"
            }}>{rule.severity}</span>
          )}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.5, fontFamily: "Georgia, serif" }}>{rule.reason}</p>
    </div>
  );
}

function LimeRow({ item }) {
  const isRisk = item.weight > 0;
  const pct = Math.min(Math.abs(item.weight) / 2, 1) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
      <span style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, minWidth: 180 }}>{item.condition}</span>
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: isRisk ? C.red : C.green,
          boxShadow: `0 0 4px ${isRisk ? C.red : C.green}`,
          transition: "width 0.5s ease"
        }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: "monospace", color: isRisk ? C.red : C.green, minWidth: 55, textAlign: "right" }}>
        {item.weight > 0 ? "+" : ""}{item.weight.toFixed(3)}
      </span>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, format }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{label}</span>
        <span style={{ fontSize: 12, color: C.accent, fontFamily: "monospace", fontWeight: 700 }}>{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: C.accent, cursor: "pointer" }}
      />
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 5 }}>{label}</div>
      <select
        value={value} onChange={e => onChange(Number(e.target.value))}
        style={{
          width: "100%", background: C.surface, color: C.text,
          border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px",
          fontSize: 12, fontFamily: "monospace", cursor: "pointer"
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Tab component ──
function Tabs({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
      {tabs.map(t => (
        <button
          key={t} onClick={() => onSelect(t)}
          style={{
            padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
            fontSize: 11, fontFamily: "monospace", fontWeight: active === t ? 700 : 400,
            color: active === t ? C.accent : C.muted,
            borderBottom: active === t ? `2px solid ${C.accent}` : "2px solid transparent",
            transition: "all 0.2s"
          }}
        >{t}</button>
      ))}
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [form, setForm] = useState({
    age: 30,
    income: 55000,
    employmentYears: 5,
    employmentType: 0,
    creditScore: 640,
    numCreditAccounts: 4,
    numLatePayments: 1,
    creditHistoryYears: 7,
    existingDebt: 15000,
    loanAmount: 25000,
    loanTermMonths: 36,
    dtiRatio: 0.32,
    loanPurpose: 0,
    savingsBalance: 8000,
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [tab, setTab] = useState("SHAP");
  const [activeSection, setActiveSection] = useState("form");

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleAnalyze = async () => {
    setLoading(true);
    setApiError(null);

    // Map camelCase form → snake_case API fields
    const payload = {
      age: form.age,
      income: form.income,
      employment_years: form.employmentYears,
      employment_type: form.employmentType,
      credit_score: form.creditScore,
      num_credit_accounts: form.numCreditAccounts,
      num_late_payments: form.numLatePayments,
      credit_history_years: form.creditHistoryYears,
      existing_debt: form.existingDebt,
      loan_amount: form.loanAmount,
      loan_term_months: form.loanTermMonths,
      dti_ratio: form.dtiRatio,
      loan_purpose: form.loanPurpose,
      savings_balance: form.savingsBalance,
    };

    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      setResult(mapApiResponse(data));
      setActiveSection("result");
    } catch (e) {
      setApiError(e.message || "Could not reach the API. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const decisionColor = result
    ? result.decision === "APPROVED" ? C.green : C.red
    : C.text;

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "system-ui, sans-serif",
      backgroundImage: `
        radial-gradient(ellipse at 20% 20%, rgba(0,212,255,0.04) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 80%, rgba(255,68,68,0.04) 0%, transparent 60%)
      `
    }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(17,24,39,0.8)", backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 50
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.accent}, #0066ff)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: `0 0 20px rgba(0,212,255,0.3)`
          }}>⚖️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.05em", fontFamily: "monospace" }}>
              CREDIT<span style={{ color: C.accent }}>IQ</span>
            </div>
            <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace", letterSpacing: "0.15em" }}>
              EXPLAINABLE AI · LOAN SCORING
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["XGBoost", "SHAP", "LIME", "Rules"].map(tag => (
            <span key={tag} style={{
              fontSize: 9, fontFamily: "monospace", color: C.accentDim,
              border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 8px"
            }}>{tag}</span>
          ))}
          <span style={{
            fontSize: 9, fontFamily: "monospace",
            color: C.green, border: `1px solid rgba(0,230,118,0.3)`,
            borderRadius: 4, padding: "3px 8px", background: "rgba(0,230,118,0.06)"
          }}>⬤ LIVE API</span>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24, alignItems: "start" }}>

          {/* ── LEFT: Input Form ── */}
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: 24, position: "sticky", top: 80
          }}>
            <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: C.accent, marginBottom: 20, letterSpacing: "0.1em" }}>
              APPLICANT PROFILE
            </div>

            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 12, letterSpacing: "0.08em" }}>— DEMOGRAPHICS —</div>
            <Slider label="Age" min={18} max={75} step={1} value={form.age} onChange={set("age")} />
            <Slider label="Annual Income" min={10000} max={250000} step={1000} value={form.income} onChange={set("income")} format={v => `$${v.toLocaleString()}`} />

            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 12, marginTop: 8, letterSpacing: "0.08em" }}>— EMPLOYMENT —</div>
            <Select label="Employment Type" value={form.employmentType} onChange={set("employmentType")}
              options={[{value:0,label:"Full-time Employed"},{value:1,label:"Self-employed"},{value:2,label:"Part-time"},{value:3,label:"Unemployed"}]}
            />
            <Slider label="Years Employed" min={0} max={40} step={0.5} value={form.employmentYears} onChange={set("employmentYears")} format={v => `${v}y`} />

            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 12, marginTop: 8, letterSpacing: "0.08em" }}>— CREDIT HISTORY —</div>
            <Slider label="Credit Score" min={300} max={850} step={5} value={form.creditScore} onChange={set("creditScore")}
              format={v => {
                const tier = v >= 740 ? "Excellent" : v >= 670 ? "Good" : v >= 580 ? "Fair" : "Poor";
                return `${v} (${tier})`;
              }}
            />
            <Slider label="Late Payments" min={0} max={10} step={1} value={form.numLatePayments} onChange={set("numLatePayments")} />
            <Slider label="Credit History Years" min={0} max={30} step={0.5} value={form.creditHistoryYears} onChange={set("creditHistoryYears")} format={v => `${v}y`} />

            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 12, marginTop: 8, letterSpacing: "0.08em" }}>— FINANCIALS —</div>
            <Slider label="Existing Debt" min={0} max={150000} step={500} value={form.existingDebt} onChange={set("existingDebt")} format={v => `$${v.toLocaleString()}`} />
            <Slider label="Savings Balance" min={0} max={100000} step={500} value={form.savingsBalance} onChange={set("savingsBalance")} format={v => `$${v.toLocaleString()}`} />
            <Slider label="Debt-to-Income Ratio" min={0} max={1} step={0.01} value={form.dtiRatio} onChange={set("dtiRatio")} format={v => `${(v*100).toFixed(0)}%`} />

            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 12, marginTop: 8, letterSpacing: "0.08em" }}>— LOAN REQUEST —</div>
            <Slider label="Loan Amount" min={1000} max={100000} step={500} value={form.loanAmount} onChange={set("loanAmount")} format={v => `$${v.toLocaleString()}`} />
            <Select label="Loan Term" value={form.loanTermMonths} onChange={set("loanTermMonths")}
              options={[{value:12,label:"12 months"},{value:24,label:"24 months"},{value:36,label:"36 months"},{value:48,label:"48 months"},{value:60,label:"60 months"},{value:84,label:"84 months"}]}
            />
            <Select label="Loan Purpose" value={form.loanPurpose} onChange={set("loanPurpose")}
              options={[{value:0,label:"🏠 Home Improvement"},{value:1,label:"🚗 Vehicle"},{value:2,label:"🎓 Education"},{value:3,label:"💳 Personal"},{value:4,label:"💼 Business"}]}
            />

            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{
                width: "100%", marginTop: 20, padding: "14px 0",
                background: loading ? C.shimmer : `linear-gradient(135deg, ${C.accent}, #0066ff)`,
                color: loading ? C.muted : "#000",
                border: "none", borderRadius: 8, fontWeight: 800,
                fontSize: 13, fontFamily: "monospace", letterSpacing: "0.1em",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : `0 0 30px rgba(0,212,255,0.4)`,
                transition: "all 0.3s"
              }}
            >
              {loading ? "⟳  ANALYZING..." : "⚡  ANALYZE CREDIT RISK"}
            </button>
          </div>

          {/* ── RIGHT: Results ── */}
          <div>
            {!result && !apiError && (
              <div style={{
                background: C.card, border: `1px dashed ${C.border}`,
                borderRadius: 12, padding: 60, textAlign: "center"
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <div style={{ fontSize: 14, color: C.muted, fontFamily: "monospace" }}>
                  Fill in the applicant profile and click<br />
                  <span style={{ color: C.accent }}>ANALYZE CREDIT RISK</span> to see the full XAI breakdown
                </div>
              </div>
            )}

            {apiError && (
              <div style={{
                background: "rgba(255,68,68,0.07)", border: `1px solid rgba(255,68,68,0.3)`,
                borderRadius: 12, padding: 28, textAlign: "center"
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
                <div style={{ fontSize: 13, color: C.red, fontFamily: "monospace", fontWeight: 700, marginBottom: 8 }}>
                  API CONNECTION ERROR
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 16 }}>
                  {apiError}
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "Georgia, serif", lineHeight: 1.7 }}>
                  Make sure the backend is running:<br />
                  <span style={{ color: C.accent, fontFamily: "monospace" }}>
                    uvicorn api:app --reload --port 8000
                  </span>
                </div>
              </div>
            )}

            {result && (
              <div>
                {/* Decision Banner */}
                <div style={{
                  background: result.decision === "APPROVED"
                    ? "linear-gradient(135deg, rgba(0,230,118,0.12), rgba(0,230,118,0.04))"
                    : "linear-gradient(135deg, rgba(255,68,68,0.12), rgba(255,68,68,0.04))",
                  border: `1px solid ${result.decision === "APPROVED" ? "rgba(0,230,118,0.3)" : "rgba(255,68,68,0.3)"}`,
                  borderRadius: 12, padding: 24, marginBottom: 20,
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 6 }}>LOAN DECISION</div>
                    <div style={{
                      fontSize: 36, fontWeight: 900, fontFamily: "monospace",
                      color: decisionColor, letterSpacing: "0.05em",
                      textShadow: `0 0 30px ${decisionColor}88`
                    }}>
                      {result.decision === "APPROVED" ? "✓ " : "✗ "}{result.decision}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", marginTop: 6 }}>
                      Risk tier: <span style={{ color: C.text }}>{result.riskTier}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <GaugeChart value={result.probDefault} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>APPROVAL PROB</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: C.green, fontFamily: "monospace" }}>
                        {(result.probApproved * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>DEFAULT PROB</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: C.red, fontFamily: "monospace" }}>
                        {(result.probDefault * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* XAI Tabs */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
                  <Tabs tabs={["SHAP", "LIME", "Decision Rules"]} active={tab} onSelect={setTab} />

                  {tab === "SHAP" && (
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 16, lineHeight: 1.6 }}>
                        <span style={{ color: C.accent }}>SHAP (SHapley Additive exPlanations)</span> — Each bar shows how much a feature pushed the prediction toward rejection (red →) or approval (← green), relative to the average prediction.
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.red, fontFamily: "monospace", marginBottom: 10, letterSpacing: "0.1em" }}>▲ TOP RISK FACTORS</div>
                          {result.shapContribs.filter(c => c.shap > 0).slice(0, 5).map((c, i) => <ShapBar key={i} contrib={c} />)}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.green, fontFamily: "monospace", marginBottom: 10, letterSpacing: "0.1em" }}>▼ TOP PROTECTIVE FACTORS</div>
                          {result.shapContribs.filter(c => c.shap <= 0).slice(0, 5).map((c, i) => <ShapBar key={i} contrib={c} />)}
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === "LIME" && (
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 16, lineHeight: 1.6 }}>
                        <span style={{ color: C.accent }}>LIME (Local Interpretable Model-agnostic Explanations)</span> — Fits a simple linear model around this specific applicant's data point to explain the local decision boundary.
                      </div>
                      {result.lime.map((item, i) => <LimeRow key={i} item={item} />)}
                      <div style={{ marginTop: 16, fontSize: 10, color: C.muted, fontFamily: "monospace", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                        Positive weight = increases default risk · Negative weight = reduces default risk
                      </div>
                    </div>
                  )}

                  {tab === "Decision Rules" && (
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 16, lineHeight: 1.6 }}>
                        <span style={{ color: C.accent }}>Rule-Based Explanations</span> — Transparent business logic rules applied to this application. Each rule maps directly to a lendable, auditable criterion.
                      </div>
                      {result.rules.map((r, i) => <RuleCard key={i} rule={r} />)}
                    </div>
                  )}
                </div>

                {/* What-if summary */}
                {result.decision === "REJECTED" && (
                  <div style={{
                    background: "rgba(0,212,255,0.04)", border: `1px solid rgba(0,212,255,0.2)`,
                    borderRadius: 12, padding: 20
                  }}>
                    <div style={{ fontSize: 11, color: C.accent, fontFamily: "monospace", fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>
                      💡 HOW TO IMPROVE YOUR APPLICATION
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        form.creditScore < 650 && { tip: "Raise credit score to 650+", action: "Pay bills on time, reduce utilization" },
                        form.dtiRatio > 0.35 && { tip: "Lower DTI below 35%", action: "Pay down existing debt before applying" },
                        form.numLatePayments > 0 && { tip: "Clear late payment history", action: "Dispute errors, make all payments on time" },
                        form.savingsBalance < 5000 && { tip: "Build savings to $5,000+", action: "Shows lender you have a financial buffer" },
                        form.employmentType > 1 && { tip: "Secure stable employment", action: "Full-time role significantly reduces risk" },
                      ].filter(Boolean).map((item, i) => (
                        <div key={i} style={{
                          background: C.shimmer, borderRadius: 8, padding: 12,
                          border: `1px solid ${C.border}`
                        }}>
                          <div style={{ fontSize: 11, color: C.text, fontFamily: "monospace", fontWeight: 700 }}>{item.tip}</div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontFamily: "Georgia, serif" }}>{item.action}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
