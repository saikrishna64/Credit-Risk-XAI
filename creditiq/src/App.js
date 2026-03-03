import { useState, useEffect } from "react";

const API_URL = "https://credit-risk-api.onrender.com";

const INR = (val) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(2)} L`;
  if (val >= 1000)     return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Number(val).toLocaleString("en-IN")}`;
};

function mapApiResponse(data) {
  const shapContribs = (data.shap_all || []).map(s => ({
    feature: s.display_name, value: s.value, shap: s.shap_value, display: String(s.value),
  }));
  const lime = (data.lime_contributions || []).map(l => ({ condition: l.feature_condition, weight: l.weight }));
  const rules = (data.rule_explanations || []).map(r => ({
    factor: r.factor, value: r.value, severity: r.severity, impact: r.impact, reason: r.explanation,
  }));
  return {
    decision: data.decision, probDefault: data.probability_default,
    probApproved: data.probability_approved, riskTier: data.risk_tier,
    shapContribs, lime, rules, summaryMessage: data.summary_message,
  };
}

function AnimatedNumber({ target, duration = 1200, suffix = "" }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <span>{current.toFixed(1)}{suffix}</span>;
}

function RingGauge({ value, size = 170 }) {
  const [animVal, setAnimVal] = useState(0);
  const pct = Math.min(Math.max(value, 0), 1);
  const color = pct < 0.25 ? "#00e676" : pct < 0.45 ? "#ffd600" : pct < 0.65 ? "#ff9800" : "#ff3d3d";
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1400, 1);
      setAnimVal((1 - Math.pow(1 - p, 4)) * pct);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [pct]);
  const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={74} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${circ * animVal} ${circ}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke 0.4s" }} />
        {[0,25,50,75,100].map(t => {
          const a = (t / 100) * 2 * Math.PI - Math.PI / 2;
          return <line key={t} x1={cx + 70 * Math.cos(a)} y1={cy + 70 * Math.sin(a)}
            x2={cx + 76 * Math.cos(a)} y2={cy + 76 * Math.sin(a)}
            stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />;
        })}
        <text x={cx} y={cy - 8} textAnchor="middle" fill={color}
          fontSize="26" fontWeight="900" fontFamily="'Courier New', monospace"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
          {(animVal * 100).toFixed(0)}%
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(255,255,255,0.35)"
          fontSize="8" fontFamily="monospace" letterSpacing="2">DEFAULT</text>
        <text x={cx} y={cy + 21} textAnchor="middle" fill="rgba(255,255,255,0.35)"
          fontSize="8" fontFamily="monospace" letterSpacing="2">PROBABILITY</text>
      </svg>
    </div>
  );
}

function ShapBar({ contrib, index }) {
  const [w, setW] = useState(0);
  const pct = Math.min(Math.abs(contrib.shap) / 3.5, 1) * 100;
  const isRisk = contrib.shap > 0;
  const color = isRisk ? "#ff4444" : "#00e676";
  useEffect(() => { const t = setTimeout(() => setW(pct), 100 + index * 80); return () => clearTimeout(t); }, [pct, index]);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "'Courier New', monospace" }}>{contrib.feature}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{contrib.display}</span>
          <span style={{ fontSize: 9, color, fontFamily: "monospace", fontWeight: 700,
            background: isRisk ? "rgba(255,68,68,0.12)" : "rgba(0,230,118,0.12)",
            padding: "1px 5px", borderRadius: 3 }}>
            {contrib.shap > 0 ? "+" : ""}{contrib.shap.toFixed(3)}
          </span>
        </div>
      </div>
      <div style={{ position: "relative", height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          [isRisk ? "right" : "left"]: "50%", width: `${w / 2}%`,
          background: `linear-gradient(${isRisk ? "to left" : "to right"}, ${color}cc, ${color})`,
          borderRadius: 4, boxShadow: `0 0 8px ${color}88`,
          transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)"
        }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(255,255,255,0.15)" }} />
      </div>
    </div>
  );
}

function RuleCard({ rule, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 100); return () => clearTimeout(t); }, [index]);
  const isPos = rule.impact === "POSITIVE";
  const sevColor = rule.severity === "HIGH" ? "#ff4444" : rule.severity === "MEDIUM" ? "#ff9800" : "#ffd600";
  return (
    <div style={{
      background: isPos ? "rgba(0,230,118,0.04)" : "rgba(255,68,68,0.04)",
      border: `1px solid ${isPos ? "rgba(0,230,118,0.2)" : "rgba(255,68,68,0.15)"}`,
      borderLeft: `3px solid ${isPos ? "#00e676" : sevColor}`,
      borderRadius: "0 8px 8px 0", padding: "12px 16px", marginBottom: 10,
      opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(-12px)",
      transition: "all 0.4s ease"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>{isPos ? "✅" : "❌"}</span>
          <span style={{ fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.9)", fontFamily: "'Courier New', monospace" }}>{rule.factor}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: isPos ? "#00e676" : sevColor,
            background: isPos ? "rgba(0,230,118,0.1)" : "rgba(255,68,68,0.1)", padding: "2px 8px", borderRadius: 4 }}>{rule.value}</span>
          {!isPos && <span style={{ fontSize: 8, fontFamily: "monospace", fontWeight: 900,
            color: "#07060f", background: sevColor, borderRadius: 3, padding: "2px 6px" }}>{rule.severity}</span>}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, fontFamily: "Georgia, serif" }}>{rule.reason}</p>
    </div>
  );
}

function LimeRow({ item, index }) {
  const [w, setW] = useState(0);
  const isRisk = item.weight > 0;
  const pct = Math.min(Math.abs(item.weight) / 2, 1) * 100;
  useEffect(() => { const t = setTimeout(() => setW(pct), 80 + index * 70); return () => clearTimeout(t); }, [pct, index]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "8px 12px",
      background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.38)", minWidth: 210 }}>{item.condition}</span>
      <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${w}%`,
          background: isRisk ? "linear-gradient(to right, #ff4444, #ff6b6b)" : "linear-gradient(to right, #00b248, #00e676)",
          transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)"
        }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: "monospace", minWidth: 60, textAlign: "right",
        color: isRisk ? "#ff6b6b" : "#00e676", fontWeight: 700 }}>
        {item.weight > 0 ? "+" : ""}{item.weight.toFixed(3)}
      </span>
      <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, fontFamily: "monospace",
        background: isRisk ? "rgba(255,68,68,0.15)" : "rgba(0,230,118,0.15)",
        color: isRisk ? "#ff6b6b" : "#00e676" }}>{isRisk ? "↑ RISK" : "↓ RISK"}</span>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, format, icon }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", fontFamily: "monospace", letterSpacing: "0.05em" }}>
          {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
        </span>
        <span style={{ fontSize: 12, color: "#d4a017", fontFamily: "'Courier New', monospace", fontWeight: 700,
          background: "rgba(212,160,23,0.1)", padding: "1px 8px", borderRadius: 4,
          border: "1px solid rgba(212,160,23,0.2)" }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#d4a017", cursor: "pointer" }} />
    </div>
  );
}

function Select({ label, value, options, onChange, icon }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", fontFamily: "monospace", marginBottom: 5 }}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
      </div>
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.85)",
          border: "1px solid rgba(212,160,23,0.2)", borderRadius: 6, padding: "8px 10px",
          fontSize: 12, fontFamily: "monospace", cursor: "pointer", outline: "none" }}>
        {options.map(o => <option key={o.value} value={o.value} style={{ background: "#0d0d1a" }}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Tabs({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.03)", padding: 4, borderRadius: 8 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{
          flex: 1, padding: "8px 12px", border: "none", borderRadius: 6, cursor: "pointer",
          fontSize: 10, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em",
          background: active === t ? "rgba(212,160,23,0.15)" : "transparent",
          color: active === t ? "#d4a017" : "rgba(255,255,255,0.35)",
          border: active === t ? "1px solid rgba(212,160,23,0.3)" : "1px solid transparent",
          transition: "all 0.2s",
          boxShadow: active === t ? "0 0 12px rgba(212,160,23,0.15)" : "none"
        }}>{t}</button>
      ))}
    </div>
  );
}

function ScoreBadge({ tier }) {
  const map = {
    "LOW RISK":       { color: "#00e676", bg: "rgba(0,230,118,0.1)", icon: "🟢" },
    "MODERATE RISK":  { color: "#ffd600", bg: "rgba(255,214,0,0.1)", icon: "🟡" },
    "HIGH RISK":      { color: "#ff9800", bg: "rgba(255,152,0,0.1)", icon: "🟠" },
    "VERY HIGH RISK": { color: "#ff4444", bg: "rgba(255,68,68,0.1)", icon: "🔴" },
  };
  const s = map[tier] || map["MODERATE RISK"];
  return (
    <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: s.color, background: s.bg,
      border: `1px solid ${s.color}44`, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.08em" }}>
      {s.icon} {tier}
    </span>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
      paddingBottom: 8, borderBottom: "1px solid rgba(212,160,23,0.12)" }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, color: "#d4a017", letterSpacing: "0.18em" }}>{title}</span>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState({
    age: 30, income: 600000, employmentYears: 5, employmentType: 0,
    creditScore: 650, numCreditAccounts: 4, numLatePayments: 1,
    creditHistoryYears: 7, existingDebt: 200000, loanAmount: 500000,
    loanTermMonths: 36, dtiRatio: 0.32, loanPurpose: 0, savingsBalance: 150000,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [tab, setTab] = useState("SHAP Analysis");
  const [entered, setEntered] = useState(false);

  useEffect(() => { setTimeout(() => setEntered(true), 100); }, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleAnalyze = async () => {
    setLoading(true); setApiError(null);
    const sc = 83;
    const payload = {
      age: form.age, income: Math.round(form.income / sc),
      employment_years: form.employmentYears, employment_type: form.employmentType,
      credit_score: form.creditScore, num_credit_accounts: form.numCreditAccounts,
      num_late_payments: form.numLatePayments, credit_history_years: form.creditHistoryYears,
      existing_debt: Math.round(form.existingDebt / sc), loan_amount: Math.round(form.loanAmount / sc),
      loan_term_months: form.loanTermMonths, dti_ratio: form.dtiRatio,
      loan_purpose: form.loanPurpose, savings_balance: Math.round(form.savingsBalance / sc),
    };
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Error ${res.status}`); }
      setResult(mapApiResponse(await res.json()));
    } catch (e) { setApiError(e.message); }
    finally { setLoading(false); }
  };

  const dc = result ? (result.decision === "APPROVED" ? "#00e676" : "#ff4444") : "#fff";

  return (
    <div style={{ minHeight: "100vh", background: "#07060f", color: "rgba(255,255,255,0.85)",
      fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative", overflow: "hidden" }}>

      {/* Ambient orbs */}
      <div style={{ position: "fixed", top: -150, left: "5%", width: 600, height: 600, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle, rgba(212,160,23,0.06) 0%, transparent 70%)" }} />
      <div style={{ position: "fixed", bottom: -100, right: "5%", width: 500, height: 500, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle, rgba(255,153,51,0.04) 0%, transparent 70%)" }} />

      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
        @keyframes slide-in { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input[type=range]::-webkit-slider-thumb { cursor: pointer; }
      `}</style>

      {/* HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 100,
        background: "rgba(7,6,15,0.88)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(212,160,23,0.14)" }}>
        <div style={{ height: 2, background: "linear-gradient(to right, transparent, #d4a017, #FF9933, #d4a017, transparent)" }} />
        <div style={{ padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, #d4a017, #FF9933)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 900, color: "#07060f",
              boxShadow: "0 0 25px rgba(212,160,23,0.4)" }}>₹</div>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.08em",
                  background: "linear-gradient(to right, #d4a017, #FF9933, #ffd166)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  fontFamily: "'Courier New', monospace" }}>CREDIT</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.9)",
                  fontFamily: "'Courier New', monospace" }}>RISK IQ</span>
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: "0.22em", fontFamily: "monospace" }}>
                EXPLAINABLE AI  ·  LOAN DECISION ENGINE  ·  INDIA
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[["🤖","XGBoost"],["📊","SHAP"],["🔬","LIME"],["📋","Rules"]].map(([icon,tag]) => (
              <div key={tag} style={{ display: "flex", alignItems: "center", gap: 4,
                fontSize: 9, fontFamily: "monospace", color: "rgba(212,160,23,0.65)",
                border: "1px solid rgba(212,160,23,0.2)", borderRadius: 6,
                padding: "4px 10px", background: "rgba(212,160,23,0.04)" }}>
                <span>{icon}</span><span>{tag}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, fontFamily: "monospace",
              color: "#00e676", border: "1px solid rgba(0,230,118,0.3)", borderRadius: 6,
              padding: "4px 10px", background: "rgba(0,230,118,0.06)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e676", display: "inline-block",
                boxShadow: "0 0 6px #00e676", animation: "pulse-dot 2s ease infinite" }} />
              LIVE API
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: "28px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24, alignItems: "start" }}>

          {/* LEFT PANEL */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,160,23,0.18)",
            borderRadius: 16, overflow: "hidden", position: "sticky", top: 74,
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(212,160,23,0.08)",
            opacity: entered ? 1 : 0, transform: entered ? "translateX(0)" : "translateX(-20px)",
            transition: "all 0.6s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(212,160,23,0.1)",
              background: "linear-gradient(135deg, rgba(212,160,23,0.09), rgba(255,153,51,0.04))" }}>
              <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#d4a017", letterSpacing: "0.15em" }}>
                📋  APPLICANT PROFILE
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontFamily: "monospace", marginTop: 3 }}>
                Enter loan applicant details below
              </div>
            </div>
            <div style={{ padding: 20, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
              <SectionHeader icon="👤" title="DEMOGRAPHICS" />
              <Slider icon="🎂" label="Age" min={18} max={75} step={1} value={form.age} onChange={set("age")} />
              <Slider icon="💰" label="Annual Income" min={100000} max={10000000} step={10000}
                value={form.income} onChange={set("income")} format={INR} />

              <SectionHeader icon="🏢" title="EMPLOYMENT" />
              <Select icon="🏷️" label="Employment Type" value={form.employmentType} onChange={set("employmentType")}
                options={[{value:0,label:"🏢 Salaried — Full-time"},{value:1,label:"💼 Self-employed"},
                  {value:2,label:"⏰ Part-time"},{value:3,label:"❌ Unemployed"}]} />
              <Slider icon="📅" label="Years Employed" min={0} max={40} step={0.5}
                value={form.employmentYears} onChange={set("employmentYears")} format={v => `${v} yrs`} />

              <SectionHeader icon="📈" title="CREDIT HISTORY" />
              <Slider icon="⭐" label="CIBIL Credit Score" min={300} max={900} step={5}
                value={form.creditScore} onChange={set("creditScore")}
                format={v => `${v} · ${v>=750?"Excellent":v>=700?"Good":v>=650?"Fair":"Poor"}`} />
              <Slider icon="⚠️" label="Late Payments" min={0} max={10} step={1} value={form.numLatePayments} onChange={set("numLatePayments")} />
              <Slider icon="🕒" label="Credit History Length" min={0} max={30} step={0.5}
                value={form.creditHistoryYears} onChange={set("creditHistoryYears")} format={v => `${v} yrs`} />

              <SectionHeader icon="💳" title="FINANCIAL POSITION" />
              <Slider icon="🏦" label="Existing Debt" min={0} max={5000000} step={5000}
                value={form.existingDebt} onChange={set("existingDebt")} format={INR} />
              <Slider icon="🏧" label="Savings Balance" min={0} max={5000000} step={5000}
                value={form.savingsBalance} onChange={set("savingsBalance")} format={INR} />
              <Slider icon="📊" label="Debt-to-Income Ratio" min={0} max={1} step={0.01}
                value={form.dtiRatio} onChange={set("dtiRatio")} format={v => `${(v*100).toFixed(0)}%`} />

              <SectionHeader icon="📄" title="LOAN REQUEST" />
              <Slider icon="💵" label="Loan Amount" min={10000} max={10000000} step={10000}
                value={form.loanAmount} onChange={set("loanAmount")} format={INR} />
              <Select icon="📆" label="Loan Term" value={form.loanTermMonths} onChange={set("loanTermMonths")}
                options={[12,24,36,48,60,84].map(m => ({value:m,label:`${m} months`}))} />
              <Select icon="🎯" label="Loan Purpose" value={form.loanPurpose} onChange={set("loanPurpose")}
                options={[{value:0,label:"🏠 Home Improvement"},{value:1,label:"🚗 Vehicle"},
                  {value:2,label:"🎓 Education"},{value:3,label:"💳 Personal"},{value:4,label:"💼 Business"}]} />

              <button onClick={handleAnalyze} disabled={loading} style={{
                width: "100%", marginTop: 16, padding: "15px 0",
                background: loading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #d4a017, #FF9933, #d4a017)",
                backgroundSize: "200% auto",
                color: loading ? "rgba(255,255,255,0.25)" : "#07060f",
                border: "none", borderRadius: 10, fontWeight: 900,
                fontSize: 12, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 30px rgba(212,160,23,0.4), 0 4px 20px rgba(0,0,0,0.3)",
                transition: "all 0.3s"
              }}>
                {loading ? "⟳   ANALYZING RISK..." : "⚡   ANALYZE CREDIT RISK"}
              </button>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ opacity: entered ? 1 : 0, transform: entered ? "translateX(0)" : "translateX(20px)",
            transition: "all 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s" }}>

            {!result && !apiError && !loading && (
              <div style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(212,160,23,0.18)",
                borderRadius: 16, padding: "80px 40px", textAlign: "center" }}>
                <div style={{ fontSize: 60, marginBottom: 20, opacity: 0.3, fontWeight: 900,
                  fontFamily: "'Courier New', monospace", color: "#d4a017" }}>₹</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.2)",
                  fontFamily: "'Courier New', monospace", marginBottom: 10 }}>Awaiting Analysis</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 2 }}>
                  Configure the applicant profile on the left<br />
                  and click <span style={{ color: "#d4a017" }}>ANALYZE CREDIT RISK</span>
                </div>
              </div>
            )}

            {loading && (
              <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(212,160,23,0.15)",
                borderRadius: 16, padding: "80px 40px", textAlign: "center" }}>
                <div style={{ fontSize: 44, marginBottom: 16, animation: "spin-slow 2s linear infinite", display: "inline-block" }}>⚙️</div>
                <div style={{ fontSize: 14, color: "#d4a017", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                  Running XGBoost + SHAP + LIME...
                </div>
              </div>
            )}

            {apiError && (
              <div style={{ background: "rgba(255,68,68,0.05)", border: "1px solid rgba(255,68,68,0.25)",
                borderRadius: 16, padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontSize: 14, color: "#ff6b6b", fontFamily: "monospace", fontWeight: 700, marginBottom: 8 }}>API CONNECTION FAILED</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>{apiError}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.8 }}>
                  Start the backend server:<br />
                  <code style={{ color: "#d4a017", background: "rgba(212,160,23,0.1)", padding: "4px 10px", borderRadius: 4 }}>
                    uvicorn api:app --reload --port 8000
                  </code>
                </div>
              </div>
            )}

            {result && !loading && (
              <div style={{ animation: "slide-in 0.5s ease" }}>

                {/* Decision Hero */}
                <div style={{
                  background: result.decision === "APPROVED"
                    ? "linear-gradient(135deg, rgba(0,230,118,0.08), rgba(0,178,72,0.03))"
                    : "linear-gradient(135deg, rgba(255,68,68,0.1), rgba(180,0,0,0.03))",
                  border: `1px solid ${result.decision === "APPROVED" ? "rgba(0,230,118,0.22)" : "rgba(255,68,68,0.22)"}`,
                  borderTop: `3px solid ${dc}`,
                  borderRadius: 16, padding: 28, marginBottom: 20,
                  boxShadow: `0 8px 40px ${result.decision === "APPROVED" ? "rgba(0,230,118,0.06)" : "rgba(255,68,68,0.06)"}`,
                  display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center"
                }}>
                  <div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontFamily: "monospace",
                      letterSpacing: "0.2em", marginBottom: 10 }}>LOAN DECISION</div>
                    <div style={{ fontSize: 38, fontWeight: 900, color: dc,
                      fontFamily: "'Courier New', monospace", letterSpacing: "0.04em",
                      textShadow: `0 0 40px ${dc}66`, lineHeight: 1, marginBottom: 14 }}>
                      {result.decision === "APPROVED" ? "✓ APPROVED" : "✗ REJECTED"}
                    </div>
                    <ScoreBadge tier={result.riskTier} />
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 12,
                      fontFamily: "Georgia, serif", lineHeight: 1.7, maxWidth: 240 }}>
                      {result.summaryMessage}
                    </div>
                  </div>
                  <RingGauge value={result.probDefault} size={170} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { label: "APPROVAL PROBABILITY", val: result.probApproved, color: "#00e676" },
                      { label: "DEFAULT PROBABILITY",  val: result.probDefault,  color: "#ff4444" },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${color}33`, borderRadius: 10, padding: "14px 18px", textAlign: "center",
                        boxShadow: `0 0 20px ${color}0d` }}>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace",
                          letterSpacing: "0.15em", marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color, fontFamily: "'Courier New', monospace",
                          textShadow: `0 0 20px ${color}88` }}>
                          <AnimatedNumber target={val * 100} suffix="%" />
                        </div>
                      </div>
                    ))}
                    <div style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.2)",
                      borderRadius: 10, padding: "12px 18px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontFamily: "monospace",
                        letterSpacing: "0.15em", marginBottom: 6 }}>LOAN AMOUNT</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#d4a017",
                        fontFamily: "'Courier New', monospace" }}>{INR(form.loanAmount)}</div>
                    </div>
                  </div>
                </div>

                {/* XAI Panel */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,160,23,0.14)",
                  borderRadius: 16, padding: 24, marginBottom: 20,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#d4a017", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.15em" }}>
                      🔬  EXPLAINABILITY ENGINE
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "monospace" }}>3 XAI Methods Active</div>
                  </div>
                  <Tabs tabs={["SHAP Analysis", "LIME Breakdown", "Decision Rules"]} active={tab} onSelect={setTab} />

                  {tab === "SHAP Analysis" && (
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", fontFamily: "monospace",
                        marginBottom: 20, lineHeight: 1.8, padding: "10px 14px",
                        background: "rgba(212,160,23,0.04)", borderRadius: 8, border: "1px solid rgba(212,160,23,0.1)" }}>
                        <span style={{ color: "#d4a017" }}>SHAP</span> — SHapley Additive exPlanations. Each bar shows a feature's exact contribution.
                        Red pushes toward <span style={{ color: "#ff6b6b" }}>REJECTION</span>, green pushes toward <span style={{ color: "#00e676" }}>APPROVAL</span>.
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
                        <div>
                          <div style={{ fontSize: 9, color: "#ff6b6b", fontFamily: "monospace", marginBottom: 12,
                            letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4444",
                              display: "inline-block", boxShadow: "0 0 6px #ff4444" }} />TOP RISK FACTORS
                          </div>
                          {result.shapContribs.filter(c => c.shap > 0).slice(0, 5).map((c, i) => <ShapBar key={i} contrib={c} index={i} />)}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#00e676", fontFamily: "monospace", marginBottom: 12,
                            letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e676",
                              display: "inline-block", boxShadow: "0 0 6px #00e676" }} />PROTECTIVE FACTORS
                          </div>
                          {result.shapContribs.filter(c => c.shap <= 0).slice(0, 5).map((c, i) => <ShapBar key={i} contrib={c} index={i} />)}
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === "LIME Breakdown" && (
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", fontFamily: "monospace",
                        marginBottom: 20, lineHeight: 1.8, padding: "10px 14px",
                        background: "rgba(212,160,23,0.04)", borderRadius: 8, border: "1px solid rgba(212,160,23,0.1)" }}>
                        <span style={{ color: "#d4a017" }}>LIME</span> — Local Interpretable Model-agnostic Explanations.
                        A linear approximation around <em>this specific applicant</em> revealing which conditions drove the boundary decision.
                      </div>
                      {result.lime.map((item, i) => <LimeRow key={i} item={item} index={i} />)}
                      <div style={{ marginTop: 14, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace",
                        borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12, display: "flex", gap: 20 }}>
                        <span>🔴 Positive = increases default risk</span>
                        <span>🟢 Negative = reduces default risk</span>
                      </div>
                    </div>
                  )}

                  {tab === "Decision Rules" && (
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", fontFamily: "monospace",
                        marginBottom: 20, lineHeight: 1.8, padding: "10px 14px",
                        background: "rgba(212,160,23,0.04)", borderRadius: 8, border: "1px solid rgba(212,160,23,0.1)" }}>
                        <span style={{ color: "#d4a017" }}>Rule-Based Audit Trail</span> — Transparent business logic
                        applied to this application. Each rule is directly auditable, RBI-compliant, and human-readable.
                      </div>
                      {result.rules.map((r, i) => <RuleCard key={i} rule={r} index={i} />)}
                    </div>
                  )}
                </div>

                {/* Improvement tips */}
                {result.decision === "REJECTED" && (
                  <div style={{ background: "rgba(212,160,23,0.04)", border: "1px solid rgba(212,160,23,0.18)",
                    borderTop: "3px solid #d4a017", borderRadius: 16, padding: 24,
                    animation: "slide-in 0.6s ease 0.3s both" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 16 }}>💡</span>
                      <span style={{ fontSize: 11, color: "#d4a017", fontFamily: "monospace",
                        fontWeight: 700, letterSpacing: "0.12em" }}>HOW TO IMPROVE YOUR APPLICATION</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                      {[
                        form.creditScore < 700 && { icon: "⭐", tip: "Raise CIBIL score to 700+", action: "Pay EMIs on time, keep credit utilization below 30%" },
                        form.dtiRatio > 0.35 && { icon: "📉", tip: "Reduce DTI below 35%", action: "Pay down existing loans before applying again" },
                        form.numLatePayments > 0 && { icon: "🗓️", tip: "Clear late payment history", action: "Dispute errors, maintain clean record for 12 months" },
                        form.savingsBalance < 100000 && { icon: "🏦", tip: "Build ₹1L+ in savings", action: "Demonstrates financial discipline and a buffer to lenders" },
                        form.employmentType > 1 && { icon: "🏢", tip: "Secure salaried employment", action: "Salaried income significantly reduces perceived repayment risk" },
                      ].filter(Boolean).map((item, i) => (
                        <div key={i} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 14,
                          border: "1px solid rgba(212,160,23,0.13)" }}>
                          <div style={{ fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
                          <div style={{ fontSize: 11, color: "#d4a017", fontFamily: "monospace", fontWeight: 700, marginBottom: 5 }}>{item.tip}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.33)", lineHeight: 1.6 }}>{item.action}</div>
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

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(212,160,23,0.1)", marginTop: 40, padding: "16px 32px",
        textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(212,160,23,0.25), transparent)", marginBottom: 12 }} />
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.13)", fontFamily: "monospace", letterSpacing: "0.12em" }}>
          CREDIT RISK IQ  ·  AI-ASSISTED DECISIONS  ·  FINAL APPROVAL SUBJECT TO HUMAN REVIEW  ·  RBI GUIDELINES COMPLIANT
        </div>
      </div>
    </div>
  );
}
