import React, { useState } from 'react';

// Ensure every finding has an affectedAccounts array
export const ensureFindingsHasAccounts = (findings = []) => {
  return findings.map(f => ({ ...f, affectedAccounts: f.affectedAccounts ?? [] }));
};

// Hover popover to display accounts creating risk for a finding
export function ClientFindingPopover({ finding }) {
  const [open, setOpen] = useState(false);
  const hasAccounts = finding?.affectedAccounts && finding.affectedAccounts.length > 0;
  if (!finding) return null;
  return (
    <span style={{ display: 'inline-block', position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      aria-label="Accounts creating risk">
      <span style={{ cursor: 'default' }}>{finding.actualValue}</span>
      {open && hasAccounts && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          transform: 'translateY(6px)',
          background: '#0b1020',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: 8,
          minWidth: 260,
          zIndex: 1000,
          boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
        }}
        >
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Accounts creating risk</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#e2e8f0' }}>
            {finding.affectedAccounts.map((a, idx) => <li key={idx}>{a}</li>)}
          </ul>
        </div>
      )}
    </span>
  );
}

// Lightweight JSON exporter
export function downloadJSONReport({ clientName, clientId, findings, history }) {
  const payload = { clientName, clientId, findings, history, generatedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ad_secure_score_report_${(clientName||'Client').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Lightweight CSV exporter
export function exportCSVFromFindings(findings) {
  const header = ["Check","Category","Threshold","Client Finding","Severity","Client Score","Client Status","Affected Accounts"].join(",");
  const rows = (findings || []).map(f => [
    f.label,
    f.category,
    f.threshold,
    f.actualValue,
    f.severity,
    f.score,
    f.status,
    (f.affectedAccounts && f.affectedAccounts.length>0) ? f.affectedAccounts.join("; ") : ""
  ].join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ad_secure_score_checks.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
