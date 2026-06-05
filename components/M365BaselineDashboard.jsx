import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Shield, Key, Monitor, Mail, FileCheck, Activity, ShieldCheck, ClipboardCheck,
  ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle, Clock, Download,
  Save, Plus, Trash2, Search, FileSpreadsheet, BarChart3, LayoutDashboard, ListChecks,
  FileText, Sun, Moon, ExternalLink, Info, RefreshCw, TrendingUp, TrendingDown, Minus, Building2
} from 'lucide-react';

const TIER_BADGE = { standard: 'badge-standard', p1: 'badge-p1', p2: 'badge-p2', e5: 'badge-e5', a1: 'badge-standard', a3: 'badge-p1', a5: 'badge-e5' };
const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Partially Completed', 'Completed', 'N/A', 'Exempted', 'Pending Client Approval'];
const STATUS_COLORS = {
  'Not Started': '#6b7280', 'In Progress': '#f59e0b', 'Partially Completed': '#f97316',
  Completed: '#22c55e', 'N/A': '#9ca3af', Exempted: '#ef4444', 'Pending Client Approval': '#a855f7'
};
const TIER_INCLUSION = {
  all: ['standard', 'p1', 'p2', 'e5', 'a1', 'a3', 'a5'],
  standard: ['standard', 'a1'], p1: ['p1', 'standard', 'a3', 'a1'],
  p2: ['p2', 'p1', 'standard'], e5: ['e5', 'p2', 'p1', 'standard', 'a5', 'a3', 'a1'],
  a1: ['a1', 'standard'], a3: ['a3', 'a1', 'standard', 'p1'],
  a5: ['a5', 'a3', 'a1', 'standard', 'p1', 'p2', 'e5']
};

const ICON_MAP = {
  Key: <Key size={20} />, Monitor: <Monitor size={20} />, Mail: <Mail size={20} />,
  FileCheck: <FileCheck size={20} />, Activity: <Activity size={20} />,
  ShieldCheck: <ShieldCheck size={20} />, ClipboardCheck: <ClipboardCheck size={20} />,
  Shield: <Shield size={20} />
};

function TierBadge({ tier }) {
  const labels = { standard: 'Standard', p1: 'P1+', p2: 'P2+', e5: 'E5', a1: 'A1', a3: 'A3', a5: 'A5' };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_BADGE[tier] || 'badge-info'}`}>
      {labels[tier] || tier}
    </span>
  );
}

function StatusDropdown({ value, onChange }) {
  return (
    <select
      value={value || 'Not Started'}
      onChange={e => onChange(e.target.value)}
      className="text-xs border border-gray-300 dark:border-darkBorder rounded px-2 py-1 bg-white dark:bg-darkCard text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function ImpactBadge({ impact }) {
  const colors = { critical: 'badge-error', high: 'badge-warn', medium: 'badge-info', low: 'badge-ok' };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[impact] || 'badge-info'}`}>{impact}</span>;
}

function CircularProgress({ value, size = 100, strokeWidth = 8, color }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color || (value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444')}
        strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-500" />
    </svg>
  );
}

function computeCompliance(items) {
  const entries = Object.values(items).filter(i => i && i.status);
  if (entries.length === 0) return { overall: 0, counts: { 'Not Started': 0, 'In Progress': 0, 'Partially Completed': 0, Completed: 0, 'N/A': 0, Exempted: 0, 'Pending Client Approval': 0 }, total: 0 };
  const counts = { 'Not Started': 0, 'In Progress': 0, 'Partially Completed': 0, Completed: 0, 'N/A': 0, Exempted: 0, 'Pending Client Approval': 0 };
  entries.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
  const total = entries.length;
  const completed = counts.Completed || 0;
  const overall = Math.round((completed / total) * 100);
  return { overall, counts, total };
}

export default function M365BaselineDashboard() {
  const [schema, setSchema] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [tierFilter, setTierFilter] = useState('all');
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState(null);
  const [allTrends, setAllTrends] = useState({});

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setDarkMode(document.documentElement.classList.contains('dark'));
    }
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const notify = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    fetch('/api/m365-schema')
      .then(r => r.json())
      .then(d => { setSchema(d); setExpandedCats(new Set(d.categories.map(c => c.id))); })
      .catch(() => notify('Failed to load schema', 'error'));
    fetch('/api/baselines/_list')
      .then(r => r.json())
      .then(d => { setClients(d.clients || []); })
      .catch(() => notify('Failed to load clients', 'error'));
    fetch('/api/m365-trends')
      .then(r => r.json())
      .then(d => { setAllTrends(d.clients || {}); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    fetch(`/api/baselines/${selectedClientId}`)
      .then(r => r.json())
      .then(d => { setClientData(d); setEdits({}); })
      .catch(() => notify('Failed to load client data', 'error'));
  }, [selectedClientId]);

  const handleCreateClient = () => {
    const name = window.prompt('Enter client name:');
    if (!name || !name.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    setClients(prev => [...prev.filter(c => c.clientId !== id), { clientId: id, clientName: name.trim().toUpperCase() }]);
    setSelectedClientId(id);
  };

  const handleDeleteClient = async () => {
    if (!selectedClientId || !window.confirm('Delete this client and all baseline data?')) return;
    try {
      await fetch(`/api/baselines/${selectedClientId}`, { method: 'DELETE' });
      setClients(prev => prev.filter(c => c.clientId !== selectedClientId));
      setSelectedClientId(null);
      setClientData(null);
      notify('Client deleted');
    } catch { notify('Failed to delete', 'error'); }
  };

  const getItemStatus = (itemId) => {
    if (edits[itemId] !== undefined) return edits[itemId];
    return clientData?.items?.[itemId]?.status || 'Not Started';
  };

  const getItemOwner = (itemId) => {
    if (edits[`${itemId}_owner`] !== undefined) return edits[`${itemId}_owner`];
    return clientData?.items?.[itemId]?.owner || '';
  };

  const getItemComments = (itemId) => {
    if (edits[`${itemId}_comments`] !== undefined) return edits[`${itemId}_comments`];
    return clientData?.items?.[itemId]?.comments || '';
  };

  const setItemStatus = (itemId, st) => setEdits(prev => ({ ...prev, [itemId]: st }));
  const setItemOwner = (itemId, owner) => setEdits(prev => ({ ...prev, [`${itemId}_owner`]: owner }));
  const setItemComments = (itemId, comments) => setEdits(prev => ({ ...prev, [`${itemId}_comments`]: comments }));

  const hasEdits = Object.keys(edits).length > 0;

  const handleSave = async () => {
    if (!selectedClientId || !clientData) return;
    setSaving(true);
    const mergedItems = { ...(clientData.items || {}) };
    const schemaItems = schema.categories.flatMap(c => c.items).map(i => i.id);
    schemaItems.forEach(id => {
      if (edits[id] !== undefined) {
        mergedItems[id] = { ...(mergedItems[id] || {}), status: edits[id] };
      }
      if (edits[`${id}_owner`] !== undefined) {
        mergedItems[id] = { ...(mergedItems[id] || {}), owner: edits[`${id}_owner`] };
      }
      if (edits[`${id}_comments`] !== undefined) {
        mergedItems[id] = { ...(mergedItems[id] || {}), comments: edits[`${id}_comments`] };
      }
    });
    const { overall } = computeCompliance(mergedItems);
    const payload = {
      clientId: selectedClientId,
      clientName: (clientData.clientName || selectedClientId).toUpperCase(),
      licenseTier: clientData.licenseTier || 'standard',
      items: mergedItems,
      overallCompliance: overall
    };
    try {
      const res = await fetch(`/api/baselines/${selectedClientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        setEdits({});
        setClientData(prev => ({ ...prev, ...payload, lastUpdated: result.lastUpdated }));
        setClients(prev => prev.map(c =>
          c.clientId === selectedClientId
            ? { ...c, lastUpdated: result.lastUpdated, overallCompliance: overall }
            : c
        ));
        notify('Saved successfully');
        // Save trend snapshot
        const today = new Date().toISOString().slice(0, 10);
        fetch('/api/m365-trends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: selectedClientId, clientName: (clientData.clientName || selectedClientId).toUpperCase(), date: today, overallCompliance: overall, items: mergedItems })
        }).then(r => r.json()).then(trendResult => {
          if (trendResult.trends) setAllTrends(prev => ({ ...prev, [selectedClientId]: trendResult.trends }));
        }).catch(() => {});
      } else throw new Error(result.error);
    } catch (e) {
      notify('Save failed: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportJSON = () => {
    if (!clientData) return;
    const exportData = { ...clientData };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `m365-baseline-${selectedClientId}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!schema || !clientData) return;
    const rows = [['Category', 'Check Item', 'License Tier', 'Status', 'Owner', 'Comments', 'Impact', 'Effort']];
    schema.categories.forEach(cat => {
      cat.items.forEach(item => {
        rows.push([cat.label, item.label, item.tier, getItemStatus(item.id), getItemOwner(item.id), getItemComments(item.id), item.impact, item.effort]);
      });
    });
    const csv = rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `m365-baseline-${selectedClientId}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedClient = clients.find(c => c.clientId === selectedClientId);
  const itemStatuses = clientData?.items || {};
  const mergedItems = { ...itemStatuses, ...Object.fromEntries(Object.entries(edits).filter(([k]) => !k.includes('_'))) };
  const { overall: compOverall, counts: compCounts, total: compTotal } = computeCompliance(mergedItems);

  const tierProgress = (tier) => {
    if (!schema) return 0;
    const included = TIER_INCLUSION[tier] || [tier];
    const tierItems = schema.categories.flatMap(c => c.items.filter(i => included.includes(i.tier)));
    if (tierItems.length === 0) return 100;
    const completed = tierItems.map(i => getItemStatus(i.id)).filter(s => s === 'Completed').length;
    return Math.round((completed / tierItems.length) * 100);
  };

  const getFilteredItems = (category) => {
    let items = category.items;
    if (tierFilter !== 'all') {
      const included = TIER_INCLUSION[tierFilter] || [tierFilter];
      items = items.filter(i => included.includes(i.tier));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.label.toLowerCase().includes(q) || i.id.includes(q));
    }
    return items;
  };

  if (!schema) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-darkBackground">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto text-blue-500" size={40} />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading baseline schema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-darkBackground">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {notification && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${notification.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}`}>
            {notification.msg}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <ShieldCheck size={28} className="text-cyan-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">M365 Security Baselines</h1>
              <p className="text-xs text-gray-500">Multi-Client Compliance Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={toggleDark} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              {darkMode ? <Sun size={18} className="text-gray-500" /> : <Moon size={18} className="text-gray-500" />}
            </button>
            <div className="flex items-center space-x-2">
              <Building2 size={16} className="text-gray-400" />
              <select
                value={selectedClientId || ''}
                onChange={e => setSelectedClientId(e.target.value || null)}
                className="text-sm border border-gray-300 dark:border-darkBorder rounded-lg px-3 py-1.5 bg-white dark:bg-darkCard text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Clients</option>
                {clients.map(c => (
                  <option key={c.clientId} value={c.clientId}>{c.clientName?.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              {selectedClient && (
                <button onClick={handleDeleteClient} className="flex items-center space-x-1 text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={14} /><span>Delete</span>
                </button>
              )}
              <button onClick={handleCreateClient} className="flex items-center space-x-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={14} /><span>New Client</span>
              </button>
            </div>
          </div>
        </div>

        {!selectedClientId ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{clients.length}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Average Compliance</p>
                <p className="text-2xl font-bold" style={{ color: clients.length ? (clients.reduce((s, c) => s + (c.overallCompliance || 0), 0) / clients.length) >= 80 ? '#22c55e' : '#f59e0b' : '#6b7280' }}>
                  {clients.length ? Math.round(clients.reduce((s, c) => s + (c.overallCompliance || 0), 0) / clients.length) : 'N/A'}%
                </p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">On Track (&ge;80%)</p>
                <p className="text-2xl font-bold text-green-600">{clients.filter(c => (c.overallCompliance || 0) >= 80).length}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Needs Attention (&lt;60%)</p>
                <p className="text-2xl font-bold text-red-600">{clients.filter(c => (c.overallCompliance || 0) < 60).length}</p>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Compliance Distribution Across Clients</h3>
              {clients.length === 0 ? (
                <div className="text-center py-8">
                  <Shield size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No clients configured yet.</p>
                  <button onClick={handleCreateClient} className="inline-flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
                    <Plus size={18} /><span>Create Your First Client</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const ranges = [
                      { label: '0-25%', min: 0, max: 25, color: '#ef4444' },
                      { label: '26-50%', min: 26, max: 50, color: '#f97316' },
                      { label: '51-75%', min: 51, max: 75, color: '#f59e0b' },
                      { label: '76-89%', min: 76, max: 89, color: '#22c55e' },
                      { label: '90-100%', min: 90, max: 100, color: '#16a34a' },
                    ];
                    const maxCount = Math.max(1, ...ranges.map(r => clients.filter(c => { const v = c.overallCompliance || 0; return v >= r.min && v <= r.max; }).length));
                    return ranges.map(r => {
                      const count = clients.filter(c => { const v = c.overallCompliance || 0; return v >= r.min && v <= r.max; }).length;
                      return (
                        <div key={r.label} className="flex items-center space-x-3">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16">{r.label}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-6 relative overflow-hidden">
                            <div className="h-full rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: r.color }}>
                              <span className="text-xs font-bold text-white">{count}</span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {clients.length > 0 && (
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-darkBorder">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Clients</h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-darkBorder">
                  {[...clients].sort((a, b) => (b.overallCompliance || 0) - (a.overallCompliance || 0)).map(c => {
                    const trend = allTrends[c.clientId];
                    const change = trend && trend.length > 1 ? trend[trend.length - 1].overallCompliance - trend[trend.length - 2].overallCompliance : null;
                    return (
                      <div key={c.clientId} onClick={() => setSelectedClientId(c.clientId)} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${(c.overallCompliance || 0) >= 80 ? 'bg-green-500' : (c.overallCompliance || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.clientName?.toUpperCase()}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tier: {c.licenseTier || 'standard'}{c.lastUpdated ? ` · Updated: ${c.lastUpdated}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {change !== null && (
                            <span className={`flex items-center text-xs font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {change > 0 ? <TrendingUp size={14} className="mr-1" /> : change < 0 ? <TrendingDown size={14} className="mr-1" /> : <Minus size={14} className="mr-1" />}
                              {change > 0 ? '+' : ''}{change}%
                            </span>
                          )}
                          <div className="text-right">
                            <p className="text-lg font-bold" style={{ color: (c.overallCompliance || 0) >= 80 ? '#22c55e' : (c.overallCompliance || 0) >= 60 ? '#f59e0b' : '#ef4444' }}>{c.overallCompliance || 0}%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex space-x-1 mb-6 border-b border-gray-200 dark:border-darkBorder">
              {[
                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                { id: 'checklist', label: 'Checklist', icon: ListChecks },
                { id: 'report', label: 'Report & Export', icon: FileText },
              ].map(tab => (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm rounded-t-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-darkCard text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card p-4 flex items-center space-x-4">
                    <div className="relative flex-shrink-0">
                      <CircularProgress value={compOverall} size={72} strokeWidth={6} />
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{compOverall}%</span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Overall</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Compliance Score</p>
                    </div>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{compCounts.Completed || 0}<span className="text-sm text-gray-400 font-normal"> / {compTotal}</span></p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${compTotal ? ((compCounts.Completed || 0) / compTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
                    <p className="text-2xl font-bold text-amber-500">{compCounts['In Progress'] || 0}</p>
                    <p className="text-xs text-gray-400 mt-2">Partial: {compCounts['Partially Completed'] || 0} | Pending: {compCounts['Pending Client Approval'] || 0}</p>
                    <p className="text-xs text-gray-400">Not Started: {compCounts['Not Started'] || 0}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">N/A or Exempted</p>
                    <p className="text-2xl font-bold text-gray-500">{(compCounts['N/A'] || 0) + (compCounts.Exempted || 0)}</p>
                    <p className="text-xs text-gray-400 mt-2">Exempted: {compCounts.Exempted || 0}</p>
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Compliance by License Tier</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {schema.licenseTiers.map(tier => {
                      const pct = tierProgress(tier.id);
                      return (
                        <div key={tier.id} className="text-center p-3 rounded-lg border border-gray-100 dark:border-darkBorder">
                          <div className="relative inline-block mb-2">
                            <CircularProgress value={pct} size={64} strokeWidth={5} color={tier.color} />
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{pct}%</span>
                          </div>
                          <p className="text-xs font-semibold" style={{ color: tier.color }}>{tier.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Compliance by Category</h3>
                  <div className="space-y-4">
                    {schema.categories.map(cat => {
                      const catItems = cat.items.map(i => ({ ...i, status: getItemStatus(i.id) }));
                      const done = catItems.filter(i => i.status === 'Completed').length;
                      const pct = catItems.length ? Math.round((done / catItems.length) * 100) : 0;
                      return (
                        <div key={cat.id} className="flex items-center space-x-4">
                          <div className="w-8 text-center" style={{ color: cat.color }}>{ICON_MAP[cat.icon] || <Shield size={16} />}</div>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{cat.label}</span>
                              <span className="text-gray-500 dark:text-gray-400">{done}/{catItems.length} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Checklist Tab */}
            {activeTab === 'checklist' && (
              <div className="space-y-4">
                <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by license:</span>
                    <div className="flex space-x-1">
                      {[{ id: 'all', label: 'All' }, ...schema.licenseTiers.map(t => ({ id: t.id, label: t.label.split('/')[0].trim() }))].map(f => (
                        <button key={f.id}
                          onClick={() => setTierFilter(f.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                            tierFilter === f.id
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" placeholder="Search checklist..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-darkBorder rounded-lg bg-white dark:bg-darkCard text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48" />
                    </div>
                    {hasEdits && (
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center space-x-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-xs px-4 py-1.5 rounded-lg transition-colors">
                        <Save size={14} />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {schema.categories.map(cat => {
                  const filteredItems = getFilteredItems(cat);
                  if (filteredItems.length === 0 && tierFilter !== 'all') return null;
                  const isExpanded = expandedCats.has(cat.id);
                  const catItems = cat.items.map(i => ({ ...i, status: getItemStatus(i.id) }));
                  const done = catItems.filter(i => i.status === 'Completed').length;
                  return (
                    <div key={cat.id} className="card overflow-hidden">
                      <button
                        onClick={() => setExpandedCats(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span style={{ color: cat.color }}>{ICON_MAP[cat.icon] || <Shield size={20} />}</span>
                          <div className="text-left">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{cat.label}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({done}/{cat.items.length} completed)</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${cat.items.length ? (done / cat.items.length) * 100 : 0}%`, backgroundColor: cat.color }} />
                          </div>
                          {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-gray-100 dark:border-darkBorder">
                          {filteredItems.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-400">No items match current filter.</div>
                          ) : (
                            <div className="divide-y divide-gray-100 dark:divide-darkBorder">
                              {filteredItems.map(item => {
                                const status = getItemStatus(item.id);
                                const owner = getItemOwner(item.id);
                                const comments = getItemComments(item.id);
                                const isEdited = edits[item.id] !== undefined;
                                return (
                                  <div key={item.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${isEdited ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2 mb-1">
                                          <TierBadge tier={item.tier} />
                                          <ImpactBadge impact={item.impact} />
                                          {isEdited && <span className="text-xs text-blue-500 font-medium">(edited)</span>}
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                                        {item.guidance && (
                                          <details className="mt-2">
                                            <summary className="text-xs text-blue-500 cursor-pointer hover:text-blue-600">Implementation guidance</summary>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-2 border-l-2 border-blue-300 dark:border-blue-700">{item.guidance}</p>
                                          </details>
                                        )}
                                      </div>
                                      <div className="flex items-start space-x-3 flex-shrink-0">
                                        <div className="text-center">
                                          <StatusDropdown value={status} onChange={s => setItemStatus(item.id, s)} />
                                          <span className="text-[10px] text-gray-400 mt-0.5 block">{item.effort} effort</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-3 mt-2">
                                      <input type="text" placeholder="Owner" value={owner}
                                        onChange={e => setItemOwner(item.id, e.target.value)}
                                        className="flex-1 text-xs border border-gray-300 dark:border-darkBorder rounded px-2 py-1 bg-white dark:bg-darkCard text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px]" />
                                      <input type="text" placeholder="Comments / notes" value={comments}
                                        onChange={e => setItemComments(item.id, e.target.value)}
                                        className="flex-1 text-xs border border-gray-300 dark:border-darkBorder rounded px-2 py-1 bg-white dark:bg-darkCard text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {hasEdits && (
                  <div className="sticky bottom-4 card p-4 flex items-center justify-between shadow-lg">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">You have unsaved changes</p>
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors font-medium">
                      <Save size={18} />
                      <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Report Tab */}
            {activeTab === 'report' && (
              <div className="space-y-6">
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Baseline Compliance Report</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Client: {selectedClient?.clientName?.toUpperCase()} | Generated: {new Date().toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={handleExportJSON}
                        className="flex items-center space-x-1 bg-gray-500 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded-lg transition-colors">
                        <Download size={16} /><span>JSON</span>
                      </button>
                      <button onClick={handleExportCSV}
                        className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded-lg transition-colors">
                        <FileSpreadsheet size={16} /><span>CSV</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-darkBorder">
                          <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Category</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Total</th>
                          <th className="text-center py-2 px-3 font-semibold text-green-600">Completed</th>
                          <th className="text-center py-2 px-3 font-semibold text-amber-500">In Progress</th>
                          <th className="text-center py-2 px-3 font-semibold text-orange-500">Partial</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-500">Not Started</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-500">N/A</th>
                          <th className="text-center py-2 px-3 font-semibold text-red-500">Exempted</th>
                          <th className="text-center py-2 px-3 font-semibold text-purple-500">Pending</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schema.categories.map(cat => {
                          const items = cat.items.map(i => ({ ...i, status: getItemStatus(i.id) }));
                          const total = items.length;
                          const counts = { 'Not Started': 0, 'In Progress': 0, 'Partially Completed': 0, Completed: 0, 'N/A': 0, Exempted: 0, 'Pending Client Approval': 0 };
                          items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
                          const pct = total ? Math.round((counts.Completed / total) * 100) : 0;
                          return (
                            <tr key={cat.id} className="border-b border-gray-100 dark:border-darkBorder hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{cat.label}</td>
                              <td className="text-center py-2 px-3">{total}</td>
                              <td className="text-center py-2 px-3 text-green-600 font-medium">{counts.Completed}</td>
                              <td className="text-center py-2 px-3 text-amber-500">{counts['In Progress']}</td>
                              <td className="text-center py-2 px-3 text-orange-500">{counts['Partially Completed']}</td>
                              <td className="text-center py-2 px-3 text-gray-400">{counts['Not Started']}</td>
                              <td className="text-center py-2 px-3 text-gray-400">{counts['N/A']}</td>
                              <td className="text-center py-2 px-3 text-red-400">{counts.Exempted}</td>
                              <td className="text-center py-2 px-3 text-purple-500">{counts['Pending Client Approval']}</td>
                              <td className="text-center py-2 px-3">
                                <span className={`font-semibold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {schema.licenseTiers.map(tier => {
                      const pct = tierProgress(tier.id);
                      return (
                        <div key={tier.id} className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder text-center">
                          <p className="text-xs font-semibold" style={{ color: tier.color }}>{tier.label}</p>
                          <p className="text-lg font-bold" style={{ color: tier.color }}>{pct}%</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Exempted Items</h3>
                    {(() => {
                      const exempted = schema.categories.flatMap(c =>
                        c.items.filter(i => getItemStatus(i.id) === 'Exempted').map(i => ({ ...i, category: c.label }))
                      );
                      if (exempted.length === 0) return <p className="text-sm text-gray-400">No exemptions recorded.</p>;
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-darkBorder">
                                <th className="text-left py-1 px-2 text-xs text-gray-500">Item</th>
                                <th className="text-left py-1 px-2 text-xs text-gray-500">Category</th>
                                <th className="text-left py-1 px-2 text-xs text-gray-500">Comments</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exempted.map(item => (
                                <tr key={item.id} className="border-b border-gray-100 dark:border-darkBorder">
                                  <td className="py-1 px-2 text-xs">{item.label}</td>
                                  <td className="py-1 px-2 text-xs text-gray-500">{item.category}</td>
                                  <td className="py-1 px-2 text-xs text-gray-500">{getItemComments(item.id) || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}