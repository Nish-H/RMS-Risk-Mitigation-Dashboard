import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

const SEV_COLORS = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#22c55e" };
const getScoreColor = s => {
  if (s <= 45) return "#ef4444";       // red
  if (s <= 54) return "#9a3412";     // dark orange
  if (s <= 64) return "#38bdf8";      // light blue
  if (s <= 70) return "#eab308";     // yellow - was light grey
  if (s <= 79) return "#84cc16";      // yellowish green
  return "#22c55e";                // green
};
const scoreColor = s => getScoreColor(s);
const scoreLabel = s => {
  if (s <= 45) return "Critical";
  if (s <= 54) return "High Risk";
  if (s <= 64) return "At Risk";
  if (s <= 70) return "Warning";
  if (s <= 79) return "Fair";
  return "Good";
};

const CATEGORIES = [
  { id: "identity",   label: "Identity & Access", color: "#00d4ff" },
  { id: "password",  label: "Password & Auth", color: "#ff6b35" },
  { id: "gpo",      label: "GPO & Hardening", color: "#a855f7" },
  { id: "dchealth",  label: "DC Health", color: "#22c55e" },
  { id: "hygiene",   label: "AD Hygiene", color: "#f59e0b" },
  { id: "monitoring", label: "Monitoring & Logs", color: "#ec4899" },
];

export default function ClientsOverview({ clients, onSelectClient, selectedClientId, refreshClients }) {
  const [filter, setFilter] = useState("all"); // all, critical, attention, improved
  
  // Compute client metrics
  const clientMetrics = useMemo(() => {
    return clients.map(c => {
      const findings = c.data?.findings || [];
      const history = c.data?.history || [];
      
      const overall = c.data?.scores?.overall || 
        (findings.length > 0 ? Math.round(findings.reduce((s,f) => s + f.score, 0) / findings.length) : 0);
      
      const catScores = c.data?.scores?.categories || {};
      
      const critFails = findings.filter(f => f.status === "Fail" && f.severity === "Critical").length;
      const highFails = findings.filter(f => f.status === "Fail" && f.severity === "High").length;
      const passCount = findings.filter(f => f.status === "Pass").length;
      
      const prevScore = history.length > 1 ? history[history.length - 2].overallScore : null;
      const moMChange = prevScore !== null ? overall - prevScore : null;
      const collectedAt = c.data?.meta?.collectedAt || c.lastUpdated || null;
      
      return {
        id: c.id,
        name: c.name,
        domain: c.data?.meta?.domain || c.domain || "",
        overall,
        catScores,
        critFails,
        highFails,
        totalFindings: findings.length,
        passCount,
        moMChange,
        prevScore,
        collectedAt,
        history,
        data: c.data
      };
    });
  }, [clients]);
  
  // Leaderboard - sorted by overall score descending
  const leaderboard = useMemo(() => {
    return [...clientMetrics].sort((a, b) => b.overall - a.overall);
  }, [clientMetrics]);
  
  // Big movers - biggest MoM change
  const bigMovers = useMemo(() => {
    return [...clientMetrics]
      .filter(c => c.moMChange !== null)
      .sort((a, b) => Math.abs(b.moMChange) - Math.abs(a.moMChange));
  }, [clientMetrics]);
  
  // Most improved - positive MoM change
  const mostImproved = useMemo(() => {
    return [...clientMetrics]
      .filter(c => c.moMChange !== null && c.moMChange > 0)
      .sort((a, b) => b.moMChange - a.moMChange);
  }, [clientMetrics]);
  
  // Needs attention - low score OR many critical findings
  const needsAttention = useMemo(() => {
    return [...clientMetrics]
      .filter(c => c.overall < 70 || c.critFails > 0 || c.highFails > 2)
      .sort((a, b) => {
        // Priority: critical findings first, then low score
        const aScore = a.critFails * 100 + a.highFails * 10 + (100 - a.overall);
        const bScore = b.critFails * 100 + b.highFails * 10 + (100 - b.overall);
        return bScore - aScore;
      });
  }, [clientMetrics]);
  
  // Category aggregates - count by least/most maintained
  const categoryStats = useMemo(() => {
    const stats = {};
    CATEGORIES.forEach(cat => {
      const scores = clientMetrics
        .filter(cm => cm.catScores[cat.id] !== undefined)
        .map(cm => cm.catScores[cat.id]);
      
      if (scores.length > 0) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        stats[cat.id] = { avg, min, max, count: scores.length };
      }
    });
    return stats;
  }, [clientMetrics]);
  
  // Industry comparison data
  const industryData = useMemo(() => {
    return CATEGORIES.map(cat => {
      const scores = clientMetrics.map(cm => cm.catScores[cat.id] || 0);
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return {
        category: cat.label,
        score: avg,
        color: cat.color
      };
    });
  }, [clientMetrics]);
  
  // Score distribution
  const scoreDistribution = useMemo(() => {
    const ranges = [
      { label: "Good (85+)", min: 85, max: 100, color: "#22c55e" },
      { label: "Average (70-84)", min: 70, max: 84, color: "#eab308" },
      { label: "High Risk (50-69)", min: 50, max: 69, color: "#f97316" },
      { label: "Critical (<50)", min: 0, max: 49, color: "#ef4444" }
    ];
    return ranges.map(range => ({
      ...range,
      count: clientMetrics.filter(c => c.overall >= range.min && c.overall <= range.max).length
    }));
  }, [clientMetrics]);
  
  // Handle client selection
  const handleClientClick = (clientId) => {
    if (onSelectClient) {
      onSelectClient(clientId);
    }
  };
  
  const S = {
    card: { 
      background: "linear-gradient(145deg,#1e293b,#0f172a)", 
      border: "1px solid #334155", 
      borderRadius: 12, 
      padding: 20,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 15px rgba(0,0,0,0.4)"
    },
    sTitle: { fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #334155" }
  };
  
  if (clients.length === 0) {
    return (
      <div style={{...S.card, padding: 60, textAlign: "center"}}>
        <div style={{fontSize: 48, marginBottom: 16}}>📊</div>
        <div style={{fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 8}}>No Clients Loaded</div>
        <div style={{fontSize: 13, color: "#94a3b8", marginBottom: 24}}>
          Import client JSON data to see the All Clients Overview
        </div>
        <button 
          onClick={refreshClients}
          style={{
            padding: "12px 24px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg,#00d4ff,#0066ff)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          ↻ Refresh Data
        </button>
      </div>
    );
  }
  
  return (
    <div style={{minHeight: "100vh"}}>
      {/* Header Stats */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24}}>
        <div style={{...S.card, borderTop: "4px solid #00d4ff"}}>
          <div style={{fontSize: 10, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8}}>Total Clients</div>
          <div style={{fontSize: 42, fontWeight: 800, color: "#00d4ff", fontFamily: "'Courier New',monospace"}}>{clients.length}</div>
          <div style={{fontSize: 11, color: "#64748b", marginTop: 4}}>environments monitored</div>
        </div>
        <div style={{...S.card, borderTop: "4px solid #22c55e"}}>
          <div style={{fontSize: 10, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8}}>Avg Score</div>
          <div style={{fontSize: 42, fontWeight: 800, color: "#22c55e", fontFamily: "'Courier New',monospace"}}>
            {Math.round(clientMetrics.reduce((s, c) => s + c.overall, 0) / clientMetrics.length)}
          </div>
          <div style={{fontSize: 11, color: "#64748b", marginTop: 4}}>across all clients</div>
        </div>
        <div style={{...S.card, borderTop: "4px solid #ef4444"}}>
          <div style={{fontSize: 10, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8}}>Critical Findings</div>
          <div style={{fontSize: 42, fontWeight: 800, color: "#ef4444", fontFamily: "'Courier New',monospace"}}>
            {clientMetrics.reduce((s, c) => s + c.critFails, 0)}
          </div>
          <div style={{fontSize: 11, color: "#64748b", marginTop: 4}}>require immediate action</div>
        </div>
        <div style={{...S.card, borderTop: "4px solid #f97316"}}>
          <div style={{fontSize: 10, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8}}>High Risk</div>
          <div style={{fontSize: 42, fontWeight: 800, color: "#f97316", fontFamily: "'Courier New',monospace"}}>
            {clientMetrics.reduce((s, c) => s + c.highFails, 0)}
          </div>
          <div style={{fontSize: 11, color: "#64748b", marginTop: 4}}>require attention</div>
        </div>
      </div>
      
      {/* Leaderboard & Big Movers */}
      <div style={{display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16, marginBottom: 24}}>
        {/* Leaderboard - List View */}
        <div style={S.card}>
          <div style={{...S.sTitle, display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <span>🏆 Client Leaderboard</span>
            <span style={{fontSize: 10, color: "#64748b"}}>Ranked by score</span>
          </div>
          <div style={{maxHeight: 320, overflowY: "auto"}}>
            {leaderboard.slice(0, 10).map((c, i) => (
              <div 
                key={c.id} 
                onClick={() => handleClientClick(c.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  marginBottom: 6,
                  borderRadius: 8,
                  background: selectedClientId === c.id ? "rgba(0,212,255,0.15)" : "#0f172a",
                  border: selectedClientId === c.id ? "1px solid #00d4ff" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: i < 3 ? ["#FFD700", "#C0C0C0", "#CD7F32"][i] : getScoreColor(c.overall),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: i < 3 ? 14 : 11,
                  fontWeight: 700,
                  color: i < 3 ? "#1e293b" : "#fff"
                }}>
                  {i + 1}
                </div>
                <div style={{flex: 1}}>
                  <div style={{fontSize: 13, fontWeight: 600, color: "#f8fafc"}}>{c.name?.toUpperCase()}</div>
                  <div style={{fontSize: 10, color: "#64748b"}}>{c.domain}</div>
                </div>
                <div style={{textAlign: "right"}}>
                  <div style={{fontSize: 22, fontWeight: 800, color: getScoreColor(c.overall), fontFamily: "monospace"}}>{c.overall}</div>
                  <div style={{fontSize: 9, color: "#94a3b8", textTransform: "uppercase"}}>{scoreLabel(c.overall)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Big Movers */}
        <div style={S.card}>
          <div style={{...S.sTitle, display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <span>📈 Big Movers</span>
            <span style={{fontSize: 10, color: "#64748b"}}>MoM change</span>
          </div>
          {bigMovers.length > 0 ? (
            <div>
              {bigMovers.slice(0, 5).map((c, i) => (
                <div key={c.id} style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 10}}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: c.moMChange > 0 ? "#22c55e" : "#ef4444",
                    boxShadow: `0 0 8px ${c.moMChange > 0 ? "#22c55e" : "#ef4444"}40`
                  }}/>
                  <div style={{flex: 1, fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                    {c.name?.toUpperCase()}
                  </div>
                  <div style={{fontSize: 13, fontWeight: 700, color: c.moMChange > 0 ? "#22c55e" : "#ef4444", fontFamily: "monospace"}}>
                    {c.moMChange > 0 ? "▲" : "▼"}{Math.abs(c.moMChange)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize: 12, color: "#64748b", textAlign: "center", padding: 40}}>
              No trend history available
            </div>
          )}
        </div>
      </div>
      
      {/* Most Improved & Needs Attention */}
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24}}>
        {/* Most Improved */}
        <div style={{...S.card, borderTop: "4px solid #22c55e"}}>
          <div style={S.sTitle}>🌱 Most Improved (MoM)</div>
          {mostImproved.length > 0 ? (
            <div>
              {mostImproved.slice(0, 5).map((c, i) => (
                <div 
                  key={c.id}
                  onClick={() => handleClientClick(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    marginBottom: 6,
                    borderRadius: 8,
                    background: "#0f172a",
                    cursor: "pointer"
                  }}
                >
                  <div style={{fontSize: 20}}>🌱</div>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 12, fontWeight: 600, color: "#f8fafc"}}>{c.name?.toUpperCase()}</div>
                    {c.prevScore && (
                      <div style={{fontSize: 10, color: "#64748b"}}>{c.prevScore} → {c.overall}</div>
                    )}
                  </div>
                  <div style={{fontSize: 18, fontWeight: 800, color: "#22c55e", fontFamily: "monospace"}}>
                    +{c.moMChange}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize: 12, color: "#64748b", textAlign: "center", padding: 30}}>
              No improvements recorded
            </div>
          )}
        </div>
        
        {/* Needs Attention */}
        <div style={{...S.card, borderTop: "4px solid #ef4444"}}>
          <div style={S.sTitle}>⚠ Urgent Attention Required</div>
          {needsAttention.length > 0 ? (
            <div>
              {needsAttention.slice(0, 5).map((c, i) => (
                <div 
                  key={c.id}
                  onClick={() => handleClientClick(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    marginBottom: 6,
                    borderRadius: 8,
                    background: "#0f172a",
                    borderLeft: `3px solid ${c.critFails > 0 ? "#ef4444" : "#f97316"}`,
                    cursor: "pointer"
                  }}
                >
                  <div style={{fontSize: 16}}>⚠</div>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 12, fontWeight: 600, color: "#f8fafc"}}>{c.name?.toUpperCase()}</div>
                    <div style={{fontSize: 10, color: "#94a3b8"}}>
                      {c.critFails > 0 && <span style={{color: "#ef4444"}}>{c.critFails} Critical</span>}
                      {c.critFails > 0 && c.highFails > 0 && " · "}
                      {c.highFails > 0 && <span style={{color: "#f97316"}}>{c.highFails} High</span>}
                    </div>
                  </div>
                  <div style={{textAlign: "right"}}>
                    <div style={{fontSize: 18, fontWeight: 800, color: scoreColor(c.overall), fontFamily: "monospace"}}>
                      {c.overall}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize: 12, color: "#22c55e", textAlign: "center", padding: 30}}>
              ✓ No urgent attention needed
            </div>
          )}
        </div>
      </div>
      
      {/* Category Analysis */}
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24}}>
        {/* Least Maintained */}
        <div style={{...S.card, borderTop: "4px solid #ef4444"}}>
          <div style={S.sTitle}>🔴 Least Maintained Categories</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart 
              data={CATEGORIES.map(cat => ({
                name: cat.label,
                score: categoryStats[cat.id]?.avg || 0,
                color: cat.color
              })).sort((a, b) => a.score - b.score).slice(0, 4)} 
              layout="vertical"
              margin={{left: -20}}
            >
              <XAxis type="number" domain={[0, 100]} tick={{fill: "#94a3b8", fontSize: 10}}/>
              <YAxis type="category" dataKey="name" tick={{fill: "#e2e8f0", fontSize: 10}} width={100}/>
              <Tooltip contentStyle={{background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11}}/>
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {CATEGORIES.map((cat, i) => <Cell key={i} fill={cat.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Most Maintained */}
        <div style={{...S.card, borderTop: "4px solid #22c55e"}}>
          <div style={S.sTitle}>🟢 Most Maintained Categories</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart 
              data={CATEGORIES.map(cat => ({
                name: cat.label,
                score: categoryStats[cat.id]?.avg || 0,
                color: cat.color
              })).sort((a, b) => b.score - a.score).slice(0, 4)} 
              layout="vertical"
              margin={{left: -20}}
            >
              <XAxis type="number" domain={[0, 100]} tick={{fill: "#94a3b8", fontSize: 10}}/>
              <YAxis type="category" dataKey="name" tick={{fill: "#e2e8f0", fontSize: 10}} width={100}/>
              <Tooltip contentStyle={{background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11}}/>
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {CATEGORIES.map((cat, i) => <Cell key={i} fill={cat.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Industry Comparison Radar */}
      <div style={{...S.card, marginBottom: 24}}>
        <div style={S.sTitle}>📊 Industry Comparison — Category Averages</div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={industryData}>
            <PolarGrid stroke="#334155"/>
            <PolarAngleAxis dataKey="category" tick={{fill: "#e2e8f0", fontSize: 11}}/>
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{fill: "#94a3b8", fontSize: 9}}/>
            <Radar name="Industry Avg" dataKey="score" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.25} strokeWidth={2}/>
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Score Distribution */}
      <div style={S.card}>
        <div style={S.sTitle}>📈 Score Distribution</div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12}}>
          {scoreDistribution.map((range, i) => (
            <div 
              key={i} 
              style={{
                padding: 16,
                borderRadius: 8,
                background: "#0f172a",
                borderLeft: `4px solid ${range.color}`,
                textAlign: "center"
              }}
            >
              <div style={{fontSize: 28, fontWeight: 800, color: range.color, fontFamily: "monospace"}}>
                {range.count}
              </div>
              <div style={{fontSize: 10, color: "#94a3b8", marginTop: 4}}>{range.label}</div>
              <div style={{marginTop: 8, height: 6, background: "#1e293b", borderRadius: 3}}>
                <div style={{
                  width: `${(range.count / clients.length) * 100}%`,
                  height: "100%",
                  borderRadius: 3,
                  background: range.color,
                  transition: "width 0.5s"
                }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}