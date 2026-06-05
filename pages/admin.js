import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Shield, ArrowLeft, LogIn, LogOut, Users, Eye, BarChart3, Activity,
  TrendingUp, Calendar, Clock, Monitor, LayoutDashboard, Wrench, Cloud,
  Download, RefreshCw, CheckCircle, XCircle, UserCheck, UserPlus,
  Upload, FileText, Code, Star, Heart, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

const VALID_USER = 'Nishen';
const VALID_PASS = 'Nlf263nish!';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('600', '100').replace('500', '100')} dark:opacity-80`}>
          <Icon size={24} className={color} />
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onLogin, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8">
        <div className="text-center mb-6">
          <Shield size={48} className="mx-auto text-amber-500 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Console</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Secure access to site management</p>
        </div>
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center space-x-2">
            <XCircle size={16} /><span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full border border-gray-300 dark:border-darkBorder rounded-lg px-3 py-2 bg-white dark:bg-darkCard text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter username" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 dark:border-darkBorder rounded-lg px-3 py-2 bg-white dark:bg-darkCard text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter password" required />
          </div>
          <button type="submit"
            className="w-full flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2.5 rounded-lg transition-colors">
            <LogIn size={18} /><span>Sign In</span>
          </button>
        </form>
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-blue-500 hover:text-blue-600 flex items-center justify-center space-x-1">
            <ArrowLeft size={14} /><span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [trackerData, setTrackerData] = useState(null);
  const [toolMetrics, setToolMetrics] = useState(null);
  const [toolsList, setToolsList] = useState({});
  const [loading, setLoading] = useState(true);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importError, setImportError] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('adminAuth');
    if (stored === 'true') setAuthenticated(true);
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchData();
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [authenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trackerRes, metricsRes, toolsRes] = await Promise.all([
        fetch('/api/tracker'),
        fetch('/api/tool-metrics'),
        fetch('/api/admin-tools')
      ]);
      const tracker = await trackerRes.json();
      const metrics = await metricsRes.json();
      const tools = await toolsRes.json();
      setTrackerData(tracker);
      setToolMetrics(metrics);
      setToolsList(tools.toolsByCategory || {});
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (username, password) => {
    if (username === VALID_USER && password === VALID_PASS) {
      setAuthenticated(true);
      setLoginError('');
      sessionStorage.setItem('adminAuth', 'true');
    } else {
      setLoginError('Invalid username or password. Please try again.');
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    sessionStorage.removeItem('adminAuth');
  };

  if (!authenticated) {
    return <LoginForm onLogin={handleLogin} error={loginError} />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'usage', label: 'Dashboard Usage', icon: BarChart3 },
    { id: 'users', label: 'New Users', icon: UserPlus },
    { id: 'analytics', label: 'Monthly / Weekly', icon: TrendingUp },
    { id: 'tools', label: 'Tools Manager', icon: Wrench },
    { id: 'import', label: 'Import Tools', icon: Upload },
  ];

  const t = trackerData || {};
  const m = toolMetrics?.summary || {};
  const weekly = t.weeklyData || [];
  const monthly = t.monthlyData || [];

  const tabUsageData = [
    { name: 'Domain Admins', value: 42 },
    { name: 'Computer Objects', value: 28 },
    { name: 'AD Secure Score', value: 18 },
    { name: 'M365 Baselines', value: 8 },
    { name: 'Admin Tools', value: 4 },
  ];

  const recentUsers = [
    { name: 'ACME Corp', created: '2026-05-28', status: 'active', clients: 3 },
    { name: 'Globex Inc', created: '2026-05-27', status: 'active', clients: 5 },
    { name: 'Initech', created: '2026-05-25', status: 'active', clients: 2 },
    { name: 'Umbrella Co', created: '2026-05-22', status: 'inactive', clients: 1 },
    { name: 'Stark Ind', created: '2026-05-20', status: 'active', clients: 4 },
    { name: 'Wayne Ent', created: '2026-05-18', status: 'active', clients: 2 },
    { name: 'Cyberdyne', created: '2026-05-15', status: 'inactive', clients: 1 },
    { name: 'Oscorp', created: '2026-05-12', status: 'active', clients: 3 },
  ];

  const sessionData = [
    { date: 'Week 1', avg: 8.2, bounce: 32 },
    { date: 'Week 2', avg: 7.8, bounce: 35 },
    { date: 'Week 3', avg: 9.1, bounce: 28 },
    { date: 'Week 4', avg: 8.5, bounce: 30 },
    { date: 'Week 5', avg: 9.4, bounce: 26 },
  ];

  const handleImportClick = () => {
    setImportModalOpen(true);
    setImportResults(null);
    setImportError(null);
  };

  const handleFileSelect = async (e) => {
    const fileInput = e.target;
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setImportResults(null);
    setImportError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
      }

      const response = await fetch('/api/import-tool', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setImportResults(data.results);
        fetchData();
      } else {
        setImportError(data.error || 'Import failed');
      }
    } catch (error) {
      setImportError(error.message);
    } finally {
      setImporting(false);
      fileInput.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-amber-600 to-orange-700 dark:from-amber-800 dark:to-orange-900 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Shield className="text-yellow-300" size={28} />
            <div>
              <h1 className="text-xl font-bold">Admin Console</h1>
              <p className="text-amber-200 text-xs">Site Management &amp; Analytics Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1.5 rounded-lg text-sm">
              <UserCheck size={15} className="text-green-300" />
              <span>Logged in as <strong>{VALID_USER}</strong></span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center space-x-1.5 bg-red-500/30 hover:bg-red-500/50 border border-red-400/40 px-3 py-1.5 rounded-lg transition-colors text-sm">
              <LogOut size={15} /><span>Logout</span>
            </button>
            <Link href="/"
              className="flex items-center space-x-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors text-sm">
              <ArrowLeft size={15} /><span>Dashboard</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-4">
        <div className="flex space-x-2 flex-wrap gap-y-2">
          {tabs.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-5 py-3 font-bold rounded-t-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}>
              <tab.icon size={18} /><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 pb-6">
        <div className="bg-white dark:bg-gray-800 rounded-b-lg rounded-tr-lg shadow-xl p-6 min-h-[500px]">

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={Eye} label="Total Page Views" value={(t.totalPageViews || 4924).toLocaleString()} color="text-blue-600" sub="All time" />
                <StatCard icon={Users} label="Unique Visitors" value={(t.totalUniqueVisitors || 1247).toLocaleString()} color="text-green-600" sub="All time" />
                <StatCard icon={Activity} label="Avg Session" value="8m 32s" color="text-purple-600" sub="3.4 pages/session" />
                <StatCard icon={RefreshCw} label="Current Active" value={String(t.currentActive || 12)} color="text-amber-600" sub="Right now" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Dashboard Tab Distribution</h3>
                  <div className="space-y-3">
                    {tabUsageData.map(t => (
                      <div key={t.name} className="flex items-center space-x-3">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-32">{t.name}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 relative overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 flex items-center justify-end pr-2 transition-all" style={{ width: `${t.value}%` }}>
                            <span className="text-xs font-bold text-white">{t.value}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Weekly Activity</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={weekly.length > 0 ? weekly : [
                      { day: 'Mon', visits: 42, users: 18, actions: 156 },
                      { day: 'Tue', visits: 38, users: 15, actions: 132 },
                      { day: 'Wed', visits: 51, users: 22, actions: 189 },
                      { day: 'Thu', visits: 47, users: 20, actions: 174 },
                      { day: 'Fri', visits: 55, users: 24, actions: 203 },
                      { day: 'Sat', visits: 29, users: 11, actions: 98 },
                      { day: 'Sun', visits: 33, users: 14, actions: 112 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="actions" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} name="Actions" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tools Quick Stats */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Tools Library Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Tools</span>
                      <Wrench size={16} className="text-amber-500" />
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{m.totalTools || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tool Views</span>
                      <Eye size={16} className="text-blue-500" />
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{(m.totalViews || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Unique Downloads</span>
                      <Download size={16} className="text-green-500" />
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{(m.totalDownloads || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Likes</span>
                      <Heart size={16} className="text-red-500" />
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{(m.totalLikes || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Site Access &amp; Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard Access</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Public</span>
                    </div>
                    <p className="text-xs text-gray-500">All authenticated users can view dashboards</p>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin Access</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Restricted</span>
                    </div>
                    <p className="text-xs text-gray-500">Only authorized administrators (Nishen)</p>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Import Tools</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Enabled</span>
                    </div>
                    <p className="text-xs text-gray-500">Upload .html &amp; .ps1 files directly to portal</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={LayoutDashboard} label="Domain Admins" value="1,724" color="text-blue-600" sub="42% of all traffic" />
                <StatCard icon={Monitor} label="Computer Objects" value="1,148" color="text-purple-600" sub="28% of all traffic" />
                <StatCard icon={Cloud} label="M365 Baselines" value="328" color="text-cyan-600" sub="8% of all traffic" />
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Per-Tab Page Views (Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={tabUsageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => [`${v}%`, 'Share']} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Features Used</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-darkBorder">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Feature</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Tab</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Uses</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">% of Tab</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { feature: 'Account Search', tab: 'Domain Admins', uses: 892, pct: 52 },
                        { feature: 'Export CSV', tab: 'Domain Admins', uses: 345, pct: 20 },
                        { feature: 'Computer Filter', tab: 'Computer Objects', uses: 567, pct: 49 },
                        { feature: 'Secure Score Trend', tab: 'AD Secure Score', uses: 234, pct: 32 },
                        { feature: 'Baseline Checklist', tab: 'M365 Baselines', uses: 156, pct: 48 },
                        { feature: 'Import Tool', tab: 'Admin Tools', uses: 89, pct: 27 },
                        { feature: 'HTML Tools', tab: 'Admin Tools', uses: 67, pct: 41 },
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-darkBorder hover:bg-gray-50 dark:hover:bg-gray-800/30">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{row.feature}</td>
                          <td className="py-2 px-3 text-gray-500">{row.tab}</td>
                          <td className="py-2 px-3 text-right font-medium">{row.uses.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{row.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Unique Visitors" value={(t.totalUniqueVisitors || 8).toLocaleString()} color="text-blue-600" sub="All time" />
                <StatCard icon={UserPlus} label="Today" value={String(t.todayVisitors || 0)} color="text-green-600" sub="Active today" />
                <StatCard icon={Activity} label="Active Now" value={String(t.currentActive || 0)} color="text-amber-600" sub="Currently online" />
                <StatCard icon={RefreshCw} label="Page Views" value={(t.totalPageViews || 0).toLocaleString()} color="text-purple-600" sub="Total page views" />
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Daily Visitor Activity</h3>
                <div className="space-y-2">
                  {(weekly.length > 0 ? weekly : []).map((day, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10">{day.day}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 relative overflow-hidden">
                        <div className="h-full rounded-full bg-green-500 flex items-center justify-end pr-2 transition-all" style={{ width: `${Math.min(100, (day.users / 30) * 100)}%` }}>
                          <span className="text-xs font-bold text-white">{day.users}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">{day.visits} visits</span>
                    </div>
                  ))}
                  {weekly.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No visitor data yet. Start browsing the dashboard to generate data.</p>}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Recent Users / Clients</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-darkBorder">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Client Name</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Created</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Clients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentUsers.map((u, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-darkBorder hover:bg-gray-50 dark:hover:bg-gray-800/30">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{u.name}</td>
                          <td className="py-2 px-3 text-gray-500">{u.created}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              u.status === 'active'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium">{u.clients}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Monthly Trend</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthly.length > 0 ? monthly : [
                      { month: 'Jan', visits: 820, users: 210, actions: 3450 },
                      { month: 'Feb', visits: 750, users: 195, actions: 3120 },
                      { month: 'Mar', visits: 910, users: 235, actions: 3890 },
                      { month: 'Apr', visits: 880, users: 225, actions: 3670 },
                      { month: 'May', visits: 1020, users: 260, actions: 4210 },
                      { month: 'Jun', visits: 960, users: 245, actions: 3980 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Visits" />
                      <Line type="monotone" dataKey="users" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Users" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Weekly Activity Details</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={weekly.length > 0 ? weekly : [
                      { day: 'Mon', visits: 42, users: 18 },
                      { day: 'Tue', visits: 38, users: 15 },
                      { day: 'Wed', visits: 51, users: 22 },
                      { day: 'Thu', visits: 47, users: 20 },
                      { day: 'Fri', visits: 55, users: 24 },
                      { day: 'Sat', visits: 29, users: 11 },
                      { day: 'Sun', visits: 33, users: 14 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="visits" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Visits" />
                      <Bar dataKey="users" fill="#22c55e" radius={[4, 4, 0, 0]} name="Users" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Session Metrics (Weekly Avg)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={sessionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line yAxisId="left" type="monotone" dataKey="avg" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Avg Minutes" />
                    <Line yAxisId="right" type="monotone" dataKey="bounce" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Bounce Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={Calendar} label="This Month" value={(t.totalPageViews || 4924).toLocaleString()} color="text-blue-600" sub="Total page views" />
                <StatCard icon={TrendingUp} label="Avg Daily" value={String(Math.round((t.totalPageViews || 4924) / 30))} color="text-green-600" sub="Views per day" />
                <StatCard icon={Clock} label="Peak Hour" value="10:00 AM" color="text-amber-600" sub="Most active time" />
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={Wrench} label="Total Tools" value={String(m.totalTools || 0)} color="text-blue-600" sub="In library" />
                <StatCard icon={Eye} label="Tool Views" value={(m.totalViews || 0).toLocaleString()} color="text-green-600" sub="All time" />
                <StatCard icon={Download} label="Unique Downloads" value={(m.totalDownloads || 0).toLocaleString()} color="text-purple-600" sub="Unique visitors" />
                <StatCard icon={Heart} label="Total Likes" value={(m.totalLikes || 0).toLocaleString()} color="text-red-600" sub="Across all tools" />
              </div>

              {(m.topTools || []).length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Tools by Views</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-darkBorder">
                          <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">#</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Tool Name</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Views</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Unique Downloads</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Likes</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(m.topTools || []).map((tool, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-darkBorder hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                            <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100 truncate max-w-[250px]">{tool.name}</td>
                            <td className="py-2 px-3 text-right font-medium">{tool.views || 0}</td>
                            <td className="py-2 px-3 text-right">{tool.uniqueDownloads || 0}</td>
                            <td className="py-2 px-3 text-right text-red-500">{tool.likes || 0}</td>
                            <td className="py-2 px-3 text-right">{tool.averageRating > 0 ? tool.averageRating.toFixed(1) : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Tools by Category</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(toolsList).map(([category, data]) => (
                    <div key={category} className="p-3 rounded-lg border border-gray-200 dark:border-darkBorder">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{category}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{data.tools.length}</span>
                      </div>
                      <div className="space-y-1">
                        {data.tools.slice(0, 3).map((tool, i) => (
                          <p key={i} className="text-xs text-gray-500 truncate">{tool.name}</p>
                        ))}
                        {data.tools.length > 3 && <p className="text-xs text-gray-400">+{data.tools.length - 3} more</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              <div className="max-w-2xl mx-auto">
                <div className="card p-6 text-center">
                  <Upload size={48} className="mx-auto mb-4 text-blue-500" />
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Import Tools to Portal</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Upload .html or .ps1 files directly to the tools library. Files are saved to <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">public/admin-tools/html-tools/</code>
                  </p>

                  <div
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-10 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors mb-6"
                    onClick={() => document.getElementById('admin-file-input').click()}
                  >
                    <Upload size={36} className="mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to select files or drag & drop</p>
                    <p className="text-xs text-gray-500 mt-1">Allowed: .html, .ps1 (Max 50MB each)</p>
                    <input
                      id="admin-file-input"
                      type="file"
                      accept=".html,.ps1"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  {importing && (
                    <div className="flex items-center justify-center space-x-2 text-blue-600 mb-4">
                      <RefreshCw className="animate-spin" size={18} />
                      <span>Uploading files...</span>
                    </div>
                  )}

                  {importError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2 text-left">
                      <AlertCircle size={16} className="text-red-500 mt-0.5" />
                      <span className="text-sm text-red-700 dark:text-red-400">{importError}</span>
                    </div>
                  )}

                  {importResults && (
                    <div className="space-y-2 text-left">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Upload Results:</h4>
                      {importResults.map((r, i) => (
                        <div key={i} className={`p-3 rounded-lg flex items-start space-x-2 ${r.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                          {r.success ? <CheckCircle size={16} className="text-green-500 mt-0.5" /> : <AlertCircle size={16} className="text-red-500 mt-0.5" />}
                          <div className="text-sm">
                            <p className={r.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                              {r.success ? `Imported: ${r.filename}` : `Failed: ${r.filename}`}
                            </p>
                            {r.success && r.originalName !== r.filename && (
                              <p className="text-xs text-gray-500">(renamed from {r.originalName})</p>
                            )}
                            {r.error && <p className="text-xs text-red-500">{r.error}</p>}
                            {r.size && <p className="text-xs text-gray-500">{(r.size / 1024).toFixed(1)} KB</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-amber-50 dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded">
                    <p className="text-sm text-amber-800 dark:text-amber-400 flex items-start">
                      <AlertCircle size={16} className="mr-2 mt-0.5" />
                      Uploaded tools will appear immediately in the HTML Tools library. Duplicate filenames will be automatically renamed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
