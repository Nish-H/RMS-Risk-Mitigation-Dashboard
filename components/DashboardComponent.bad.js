import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, Moon, Sun, Shield, AlertTriangle, CheckCircle, XCircle, Users, UserCheck, UserX, Calendar, Filter, Search, TrendingUp, TrendingDown, Clock, Key, Building2, User, ChevronDown, ChevronUp, X, Activity, Zap, Eye, Edit, Trash2 } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#EF4444', '#10B981', '#F97316', '#8B5CF6', '#EC4899'];

const getAccountTypeChartColor = (accountType) => {
  if (!accountType) return '#888888';
  
  const type = accountType.toLowerCase();
  
  if (type.includes('domain admin') || type.includes('enterprise admin') || type.includes('schema admin')) {
    return '#EF4444'; // Red
  }
  if (type.includes('ftech engineer') || type.includes('privileged')) {
    return '#F97316'; // Orange
  }
  if (type.includes('service account') || type.includes('svc') || type.includes('wssuser') || type.includes('app_') || type.includes('sql_') || type.includes('web_')) {
    return '#0088FE'; // Blue
  }
  if (type.includes('shared') || type.includes('portal') || type.includes('market') || type.includes('ittraining') || type.includes('fmconway') || type.includes('reception') || type.includes('helpdesk') || type.includes('support') || type.includes('info')) {
    return '#FFBB28'; // Yellow
  }
  if (type.includes('test') || type.includes('demo') || type.includes('dev')) {
    return '#EC4899'; // Pink
  }
  if (type.includes('emergency') || type.includes('break') || type.includes('glass')) {
    return '#8B5CF6'; // Purple
  }
  if (type.includes('standard') || type.includes('user')) {
    return '#10B981'; // Green
  }
  
  return '#888888'; // Gray
};

const SkeletonLoader = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}></div>
);

const StatCard = ({ title, value, icon: Icon, color, trend, onClick, active }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
    green: 'from-green-500 to-green-600 dark:from-green-600 dark:to-green-700',
    red: 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700',
    yellow: 'from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700',
    purple: 'from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700',
    indigo: 'from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700',
  };

  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl cursor-pointer ${active ? 'ring-4 ring-offset-2 ring-blue-500' : ''} bg-gradient-to-br ${colorClasses[color]} text-white`}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {trend && (
              <div className={`flex items-center mt-2 text-sm ${trend > 0 ? 'text-green-200' : 'text-red-200'}`}>
                {trend > 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                <span>{Math.abs(trend)}% from last period</span>
              </div>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-lg">
            <Icon size={28} />
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-10">
        <Icon size={80} />
      </div>
    </div>
  );
};

const getAccountTypeColor = (accountType) => {
  if (!accountType) return { bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'dark:bg-gray-700', darkText: 'dark:text-gray-300' };
  
  const type = accountType.toLowerCase();
  
  if (type.includes('domain admin') || type.includes('enterprise admin') || type.includes('schema admin')) {
    return { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-300' };
  }
  if (type.includes('ftech engineer') || type.includes('privileged')) {
    return { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-300' };
  }
  if (type.includes('service account') || type.includes('svc') || type.includes('wssuser') || type.includes('app_') || type.includes('sql_') || type.includes('web_')) {
    return { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-300' };
  }
  if (type.includes('shared') || type.includes('portal') || type.includes('market') || type.includes('ittraining') || type.includes('fmconway') || type.includes('reception') || type.includes('helpdesk') || type.includes('support') || type.includes('info')) {
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', darkBg: 'dark:bg-yellow-900/30', darkText: 'dark:text-yellow-300' };
  }
  if (type.includes('test') || type.includes('demo') || type.includes('dev')) {
    return { bg: 'bg-pink-100', text: 'text-pink-700', darkBg: 'dark:bg-pink-900/30', darkText: 'dark:text-pink-300' };
  }
  if (type.includes('emergency') || type.includes('break') || type.includes('glass')) {
    return { bg: 'bg-purple-100', text: 'text-purple-700', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-300' };
  }
  if (type.includes('standard') || type.includes('user')) {
    return { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'dark:bg-green-900/30', darkText: 'dark:text-green-300' };
  }
  
  return { bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'dark:bg-gray-700', darkText: 'dark:text-gray-300' };
};

const getAccountTypeBadge = (accountType) => {
  const color = getAccountTypeColor(accountType);
  return `px-2 py-1 ${color.bg} ${color.text} ${color.darkBg} ${color.darkText} rounded-full text-xs font-medium`;
};

const RiskScoreGauge = ({ score }) => {
  const getRiskColor = (score) => {
    if (score >= 80) return { color: '#10B981', label: 'Low Risk', bg: 'from-green-400 to-green-600' };
    if (score >= 60) return { color: '#FBBF24', label: 'Medium Risk', bg: 'from-yellow-400 to-yellow-600' };
    if (score >= 40) return { color: '#F97316', label: 'High Risk', bg: 'from-orange-400 to-orange-600' };
    return { color: '#EF4444', label: 'Critical', bg: 'from-red-400 to-red-600' };
  };

  const risk = getRiskColor(score);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Shield className="mr-2" style={{ color: risk.color }} />
        Risk Score
      </h3>
      <div className="relative flex items-center justify-center">
        <svg className="transform -rotate-90 w-40 h-40">
          <circle cx="70" cy="70" r="60" stroke="#e5e7eb" strokeWidth="12" fill="none" />
          <circle 
            cx="70" cy="70" r="60" 
            stroke={risk.color} 
            strokeWidth="12" 
            fill="none"
            strokeDasharray={`${(score / 100) * 377} 377`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-bold" style={{ color: risk.color }}>{score}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{risk.label}</span>
        </div>
      </div>
    </div>
  );
};

const PasswordPolicyWidget = ({ policy, customer }) => {
  if (!policy || !customer || customer === 'All') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Key className="mr-2 text-blue-500" />
          Domain Password Policy
        </h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-4">
          <p>Select a customer to view their password policy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Key className="mr-2 text-blue-500" />
        Domain Password Policy
        <span className="ml-2 text-sm font-normal text-gray-500">({customer})</span>
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Max Password Age</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{policy.MaxPasswordAgeDays || 90} days</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Min Password Length</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{policy.MinPasswordLength || 8} chars</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Password History</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{policy.PasswordHistoryCount || 24} remembered</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Lockout Threshold</p>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{policy.LockoutThreshold || 0} attempts</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Min Password Age</p>
          <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{policy.MinPasswordAgeDays || 1} day</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Complexity</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{policy.ComplexityEnabled !== false ? 'Required' : 'Disabled'}</p>
        </div>
      </div>
    </div>
  );
};

const QuickFilterButton = ({ label, icon: Icon, active, onClick, count, color }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${active ? 'ring-2 ring-offset-2 ring-blue-500' : ''} ${colorClasses[color]} hover:opacity-80`}
    >
      <Icon size={18} />
      <span>{label}</span>
      {count !== undefined && (
        <span className="bg-white/50 dark:bg-gray-800 px-2 py-0.5 rounded-full text-xs">
          {count}
        </span>
      )}
    </button>
  );
};

const AccountDetailsModal = ({ account, onClose }) => {
  if (!account) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold flex items-center">
            <User className="mr-2" />
            Account Details
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Username</label>
              <p className="font-semibold text-lg">{account.Username}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Domain</label>
              <p className="font-semibold">{account.DomainName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Time Stamp</label>
              <p className="font-semibold text-orange-600 dark:text-orange-400">
                {new Date(account.TimeStamp).toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Full Name</label>
              <p className="font-semibold">{account.FirstName} {account.LastName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Status</label>
              <p className={`font-semibold ${account.Status === 'Enabled' ? 'text-green-600' : 'text-red-600'}`}>
                {account.Status}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Account Type</label>
              <p className="font-semibold">{account.AccountType}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Password Age</label>
              <p className={`font-semibold ${parseInt(account.PasswordAgeInDays) > 90 ? 'text-red-600' : ''}`}>
                {account.PasswordAgeInDays} days
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">Description</label>
              <p className="font-semibold">{account.Description || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Last Logon</label>
              <p className="font-semibold">{new Date(account.LastLogon).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Password Last Set</label>
              <p className="font-semibold">{new Date(account.PasswordLastSet).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="p-6 border-t dark:border-gray-700 flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardHeader = ({ darkMode, setDarkMode }) => (
  <div className="mb-6">
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-800 dark:to-indigo-900 rounded-2xl p-6 text-white shadow-xl">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Shield className="text-yellow-400" size={32} />
            <h1 className="text-2xl md:text-3xl font-bold">RMS Risk Mitigation Dashboard</h1>
          </div>
          <p className="text-blue-100 text-lg">FTech Engineer & Domain Admin Accounts</p>
          <div className="flex items-center space-x-4 mt-4 text-sm text-blue-100">
            <span className="flex items-center"><Building2 size={14} className="mr-1" /> Hosted on RMS-WEB01</span>
            <span className="flex items-center"><Activity size={14} className="mr-1" /> Independent of Power-BI</span>
          </div>
        </div>
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </div>
    </div>
  </div>
);

const DashboardComponent = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [data, setData] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [selectedView, setSelectedView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [leadEngineers, setLeadEngineers] = useState({});
  const [currentLeadEngineer, setCurrentLeadEngineer] = useState(null);
  const [passwordAgeFilter, setPasswordAgeFilter] = useState(null);
  const [quickFilter, setQuickFilter] = useState(null);
  const [accountTypeFilter, setAccountTypeFilter] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  
  const [isPasswordSectionCollapsed, setIsPasswordSectionCollapsed] = useState(false);
  const [isDisabledAccountsCollapsed, setIsDisabledAccountsCollapsed] = useState(false);

  // Fetch password policy
  const fetchPasswordPolicy = async (customerName) => {
    if (!customerName || customerName === 'All') {
      setPasswordPolicy(null);
      return;
    }
    
    try {
      // Find customer data - Customer is derived from DomainName in the API
      const customerData = data.filter(item => item.DomainName && item.DomainName.toLowerCase().startsWith(customerName.toLowerCase()));
      if (customerData && customerData.length > 0) {
        const domainPolicy = customerData[0].DomainPasswordMaxAge;
        if (domainPolicy) {
          setPasswordPolicy({
            MaxPasswordAgeDays: domainPolicy,
            MinPasswordAgeDays: 1,
            MinPasswordLength: 8,
            PasswordHistoryCount: 24,
            LockoutThreshold: 0,
            ComplexityEnabled: true
          });
        } else {
          setPasswordPolicy(null);
        }
      } else {
        setPasswordPolicy(null);
      }
    } catch (error) {
      console.error('Error fetching password policy:', error);
      setPasswordPolicy(null);
    }
  };

  // Fetch password policy when customer changes
  useEffect(() => {
    if (selectedCustomer !== 'All' && data.length > 0) {
      fetchPasswordPolicy(selectedCustomer);
    } else {
      setPasswordPolicy(null);
    }
  }, [selectedCustomer, data]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark', 'bg-gray-900', 'text-gray');
    } else {
      document.body.classList.remove('dark', 'bg-gray-900', 'text-white');
    }
  }, [darkMode]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const jsonData = await response.json();
        setData(jsonData);
        
        const engineers = identifyLeadEngineers(jsonData);
        setLeadEngineers(engineers);
        
        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (selectedCustomer === 'All') {
      setCurrentLeadEngineer(null);
    } else {
      setCurrentLeadEngineer(leadEngineers[selectedCustomer] || null);
    }
  }, [selectedCustomer, leadEngineers]);

  const handlePasswordAgeFilterClick = (range) => {
    setPasswordAgeFilter(passwordAgeFilter === range ? null : range);
    if (passwordAgeFilter !== range) {
      setSelectedView('enabled');
    }
  };

  const handleQuickFilter = (filter) => {
    setQuickFilter(quickFilter === filter ? null : filter);
    if (quickFilter !== filter) {
      setSelectedView('enabled');
    } else {
      setSelectedView(null);
    }
  };

  const calculateRiskScore = (customerData) => {
    if (!customerData || customerData.length === 0) return 0;
    
    let score = 100;
    
    const enabledAccounts = customerData.filter(a => a.Status === 'Enabled');
    const disabledCount = customerData.filter(a => a.Status === 'Disabled').length;
    const totalAccounts = customerData.length;
    
    score -= (disabledCount / totalAccounts) * 20;
    
    const stalePasswords = enabledAccounts.filter(a => parseInt(a.PasswordAgeInDays) > 90).length;
    score -= (stalePasswords / enabledAccounts.length) * 30;
    
    const neverLoggedIn = enabledAccounts.filter(a => new Date(a.LastLogon).getTime() === new Date('1970-01-01').getTime()).length;
    score -= (neverLoggedIn / enabledAccounts.length) * 20;
    
    const adminAccounts = enabledAccounts.filter(a => a.AccountType?.toLowerCase().includes('admin')).length;
    score -= (adminAccounts / enabledAccounts.length) * 15;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const identifyLeadEngineers = (jsonData) => {
    const engineers = {};
    
    jsonData.forEach(record => {
      if (!record.Description) return;
      
      const description = (typeof record.Description === 'string') ? record.Description.toLowerCase() : '';
      const customer = record.Customer;
      
      if (description && description.includes("engineer")) {
        let score = 0;
        if (description.includes("lead")) score += 3;
        if (description.includes("senior")) score += 2;
        if (description.includes("principal")) score += 3;
        if (description.includes("security")) score += 1;
        if (description.includes("server")) score += 1;
        if (description.includes("rms")) score += 1;
        
        if (!engineers[customer] || engineers[customer].score < score) {
          engineers[customer] = {
            name: `${record.FirstName || ''} ${record.LastName || ''}`.trim(),
            description: record.Description,
            username: record.Username,
            score: score
          };
        }
      }
    });
    
    return engineers;
  };

  const exportToCSV = (exportData, filename) => {
    const headers = ['Username', 'DomainName', 'TimeStamp', 'FirstName', 'LastName', 'Status', 'AccountType', 
                    'LastLogon', 'PasswordLastSet', 'PasswordAgeInDays', 'Description'];
    const csvContent = [
      headers.join(','),
      ...exportData.map(item => 
        headers.map(header => 
          JSON.stringify(item[header] || '')
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const TableHeader = ({ label, sortKey, className = "" }) => (
    <th 
      className={`px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {sortConfig.key === sortKey && (
          <span>{sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        )}
      </div>
    </th>
  );

  if (error) return (
    <div className="p-8 text-center">
      <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
      <p className="text-red-600 text-xl">Error loading dashboard: {error}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Retry
      </button>
    </div>
  );

  const customers = ['All', ...new Set(data.map(item => item.Customer))].sort();
  
  let filteredData = selectedCustomer === 'All' 
    ? data 
    : data.filter(item => item.Customer === selectedCustomer);

  if (timeRange !== 'all') {
    const now = new Date();
    const daysMap = { '7days': 7, '30days': 30, '90days': 90 };
    const days = daysMap[timeRange];
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    filteredData = filteredData.filter(item => new Date(item.TimeStamp) >= cutoff);
  }

  const enabledAccounts = filteredData.filter(item => item.Status === 'Enabled');
  const disabledAccounts = filteredData.filter(item => item.Status === 'Disabled');
  const disabledThisRun = filteredData.filter(item => item.ActionThisRun === 'Disabled');
  const staleAccounts = enabledAccounts.filter(a => parseInt(a.PasswordAgeInDays) > 90);
  const neverLoggedIn = enabledAccounts.filter(a => (new Date(a.LastLogon).getTime() === new Date('1970-01-01').getTime() || !a.LastLogon));
  const adminAccounts = enabledAccounts.filter(a => a.AccountType?.toLowerCase().includes('admin'));

  const riskScore = calculateRiskScore(filteredData);

  // Account type distribution from ALL data (for filtering across all customers)
  const accountTypeData = Object.entries(
    data.reduce((acc, item) => {
      const type = item.AccountType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {})
  ).map(([type, count]) => ({ name: type, value: count })).sort((a, b) => b.value - a.value);

  // Calculate FTech Engineer Rankings (Name & Shame - most unmaintained accounts)
  const leadEngineerRankings = Object.entries(
    data.reduce((acc, item) => {
      if (item.Description && (item.Description.includes('Engineer') || item.Description.includes('engineer'))) {
        const engineerName = `${item.FirstName || ''} ${item.LastName || ''}`.trim() || item.Username;
        const customer = item.Customer || item.DomainName?.split('.')[0];
        
        if (!acc[engineerName]) {
          acc[engineerName] = { 
            name: engineerName, 
            customer: customer,
            totalAccounts: 0, 
            stalePasswords: 0, 
            neverLoggedIn: 0, 
            disabled: 0,
            unmaintainedScore: 0 
          };
        }
        
        acc[engineerName].totalAccounts++;
        
        // Count stale passwords (90+ days)
        if (parseInt(item.PasswordAgeInDays) > 90) {
          acc[engineerName].stalePasswords++;
        }
        
        // Count never logged in
        if (!item.LastLogon || new Date(item.LastLogon).getTime() === new Date('1970-01-01').getTime()) {
          acc[engineerName].neverLoggedIn++;
        }
        
        // Count disabled
        if (item.Status === 'Disabled' || item.ActionThisRun === 'Disabled') {
          acc[engineerName].disabled++;
        }
        
        // Calculate unmaintained score (higher = worse)
        acc[engineerName].unmaintainedScore = 
          (acc[engineerName].stalePasswords * 3) + 
          (acc[engineerName].neverLoggedIn * 2) + 
          (acc[engineerName].disabled * 1);
      }
      return acc;
    }, {})
  ).map(([name, stats]) => stats).sort((a, b) => b.unmaintainedScore - a.unmaintainedScore);

  // Top 10 customers with most disabled accounts
  const customerDisabledRanking = Object.entries(
    data.reduce((acc, item) => {
      const customer = item.Customer || item.DomainName?.split('.')[0];
      if (!acc[customer]) acc[customer] = { customer: customer, disabledCount: 0, totalAccounts: 0 };
      
      acc[customer].totalAccounts++;
      if (item.Status === 'Disabled' || item.ActionThisRun === 'Disabled') {
        acc[customer].disabledCount++;
      }
      return acc;
    }, {})
  ).map(([customer, stats]) => stats).sort((a, b) => b.disabledCount - a.disabledCount).slice(0, 10);

  const passwordAgeData = filteredData.reduce((acc, item) => {
    const age = parseInt(item.PasswordAgeInDays);
    if (age < 30) acc['0-30']++;
    else if (age < 60) acc['31-60']++;
    else if (age < 90) acc['61-90']++;
    else acc['90+']++;
    return acc;
  }, { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 });

  const now = new Date();
  const loginData = filteredData.reduce((acc, item) => {
    const lastLogin = new Date(item.LastLogon);
    const daysSinceLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLogin <= 7) acc['Last 7 days']++;
    else if (daysSinceLogin <= 30) acc['8-30 days']++;
    else if (daysSinceLogin <= 90) acc['31-90 days']++;
    else acc['90+ days']++;
    
    return acc;
  }, { 'Last 7 days': 0, '8-30 days': 0, '31-90 days': 0, '90+ days': 0 });

  const renderAccountList = () => {
    let accounts = [];
    let title = '';

    // When account type filter is active, show ALL accounts across all customers
    if (accountTypeFilter) {
      accounts = data.filter(a => 
        a.AccountType && a.AccountType.toLowerCase().includes(accountTypeFilter.toLowerCase())
      );
      title = `${accountTypeFilter} Accounts (All Customers)`;
    } else if (selectedView === 'enabled') {
      accounts = enabledAccounts;
      title = 'Enabled Accounts';
    } else if (selectedView === 'disabled') {
      accounts = disabledAccounts;
      title = 'Disabled Accounts';
    } else {
      return null;
    }

    if (passwordAgeFilter) {
      const [minDays, maxDays] = passwordAgeFilter.split('-').map(day => 
        day === '90+' ? 90 : parseInt(day)
      );
      
      accounts = accounts.filter(account => {
        const age = parseInt(account.PasswordAgeInDays);
        if (passwordAgeFilter === '90+') {
          return age >= 90;
        } else {
          return age >= minDays && age <= maxDays;
        }
      });
      
      title = `${title} (Password Age: ${passwordAgeFilter} days)`;
    }

    if (quickFilter === 'stale') {
      accounts = accounts.filter(a => parseInt(a.PasswordAgeInDays) > 90);
      title = `${title} - Stale Passwords (90+ days)`;
    } else if (quickFilter === 'neverLoggedIn') {
      accounts = accounts.filter(a => (new Date(a.LastLogon).getTime() === new Date('1970-01-01').getTime() || !a.LastLogon));
      title = `${title} - Never Logged In`;
    } else if (quickFilter === 'admin') {
      accounts = accounts.filter(a => a.AccountType?.toLowerCase().includes('admin'));
      title = `${title} - Admin Accounts`;
    }

    if (searchQuery.trim()) {
      accounts = accounts.filter(account => 
        account.Username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${account.FirstName} ${account.LastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortConfig.key) {
      accounts = [...accounts].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) 
          return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) 
          return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (accounts.length === 0) {
      return (
        <div className="mt-4 border rounded-xl p-12 bg-white dark:bg-gray-800 shadow-lg text-center">
          <Search size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">No accounts found matching your criteria</p>
          <button 
            onClick={() => {setSearchQuery(''); setPasswordAgeFilter(null); setQuickFilter(null);}}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Clear Filters
          </button>
        </div>
      );
    }

    return (
      <div className="mt-6 border rounded-xl bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{accounts.length} accounts</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <button 
              onClick={() => { const safeName = title.replace(/[^a-zA-Z0-9]/g, '_'); exportToCSV(accounts, safeName); }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Download size={18} />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <TableHeader label="Username" sortKey="Username" />
                <TableHeader label="Domain" sortKey="DomainName" />
                <TableHeader label="Time Stamp" sortKey="TimeStamp" />
                <TableHeader label="Full Name" sortKey="FirstName" />
                <TableHeader label="Type" sortKey="AccountType" />
                <TableHeader label="Status" sortKey="Status" />
                <TableHeader label="Last Logon" sortKey="LastLogon" />
                <TableHeader label="Pwd Age" sortKey="PasswordAgeInDays" />
                <TableHeader label="Actions" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account, index) => (
                <tr 
                  key={index} 
                  className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedAccount(account)}
                >
                  <td className="px-4 py-3 font-medium">{account.Username}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{account.DomainName}</td>
                  <td className="px-4 py-3 text-orange-600 dark:text-orange-400 font-medium whitespace-nowrap">
                    {new Date(account.TimeStamp).toLocaleDateString()} {new Date(account.TimeStamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="px-4 py-3">{`${account.FirstName || ''} ${account.LastName || ''}`}</td>
                  <td className="px-4 py-3">
                    <span className={getAccountTypeBadge(account.AccountType)}>
                      {account.AccountType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {account.Status === 'Enabled' ? (
                      <span className="flex items-center text-green-600"><CheckCircle size={16} className="mr-1" /> Enabled</span>
                    ) : (
                      <span className="flex items-center text-red-600"><XCircle size={16} className="mr-1" /> Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {new Date(account.LastLogon).getTime() === new Date('1970-01-01').getTime() ? 'Never' : new Date(account.LastLogon).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${parseInt(account.PasswordAgeInDays) > 90 ? 'text-red-600' : parseInt(account.PasswordAgeInDays) > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {account.PasswordAgeInDays} days
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedAccount(account); }}
                      className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl mb-6">
          <SkeletonLoader className="h-10 w-64 mb-2" />
          <SkeletonLoader className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <SkeletonLoader key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonLoader className="h-80 rounded-xl" />
          <SkeletonLoader className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
      <div className="p-6">
        <DashboardHeader darkMode={darkMode} setDarkMode={setDarkMode} />
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard 
            title="Total Accounts" 
            value={filteredData.length} 
            icon={Users} 
            color="blue" 
            onClick={() => setSelectedView(null)}
            active={selectedView === null}
          />
          <StatCard 
            title="Enabled" 
            value={enabledAccounts.length} 
            icon={UserCheck} 
            color="green" 
            onClick={() => setSelectedView('enabled')}
            active={selectedView === 'enabled'}
          />
          <StatCard 
            title="Disabled" 
            value={disabledAccounts.length} 
            icon={UserX} 
            color="red" 
            onClick={() => setSelectedView('disabled')}
            active={selectedView === 'disabled'}
          />
          <StatCard 
            title="High Risk (90+ days)" 
            value={staleAccounts.length} 
            icon={AlertTriangle} 
            color="yellow" 
            onClick={() => handleQuickFilter('stale')}
            active={quickFilter === 'stale'}
          />
        </div>

        {/* Filters and Lead Engineer */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  <Building2 size={14} className="inline mr-1" /> Customer
                </label>
                <select 
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="p-2.5 border rounded-lg min-w-[200px] dark:bg-gray-700 dark:border-gray-600"
                >
                  {customers.map(customer => (
                    <option key={customer} value={customer}>{customer}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  <Calendar size={14} className="inline mr-1" /> Date Range
                </label>
                <select 
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  <User size={14} className="inline mr-1" /> Lead Engineer
                </label>
                <div className="p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-900 min-h-[46px]">
                  {currentLeadEngineer ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {currentLeadEngineer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{currentLeadEngineer.name}</p>
                        <p className="text-xs text-gray-500">{currentLeadEngineer.description}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">
                      {selectedCustomer === 'All' ? 'Select a customer' : 'No lead engineer identified'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:w-64">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                <Zap size={14} className="inline mr-1" /> Quick Filters
              </label>
              <div className="flex flex-wrap gap-2">
                <QuickFilterButton 
                  label="Stale" 
                  icon={Key} 
                  count={staleAccounts.length}
                  color="yellow"
                  active={quickFilter === 'stale'}
                  onClick={() => handleQuickFilter('stale')}
                />
                <QuickFilterButton 
                  label="Never Login" 
                  icon={Clock} 
                  count={neverLoggedIn.length}
                  color="red"
                  active={quickFilter === 'neverLoggedIn'}
                  onClick={() => handleQuickFilter('neverLoggedIn')}
                />
                <QuickFilterButton 
                  label="Admin" 
                  icon={Shield} 
                  count={adminAccounts.length}
                  color="purple"
                  active={quickFilter === 'admin'}
                  onClick={() => handleQuickFilter('admin')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <RiskScoreGauge score={riskScore} />
          <PasswordPolicyWidget policy={passwordPolicy} customer={selectedCustomer} />

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Key className="mr-2 text-blue-500" />
              Password Age Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(passwordAgeData).map(([range, count]) => ({ range, count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                  {Object.entries(passwordAgeData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry[0] === '90+' ? '#EF4444' : entry[0] === '61-90' ? '#F97316' : entry[0] === '31-60' ? '#FBBF24' : '#10B981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Clock className="mr-2 text-green-500" />
              Last Login Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={Object.entries(loginData).map(([period, count]) => ({
                    name: period,
                    value: count
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label
                >
                  {Object.entries(loginData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Type & Disabled Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Users className="mr-2 text-purple-500" />
                Account Type Distribution
              </h3>
              {accountTypeFilter && (
                <button 
                  onClick={() => { setAccountTypeFilter(null); setSelectedView(null); }}
                  className="text-xs text-blue-500 hover:underline flex items-center"
                >
                  <X size={12} className="mr-1" /> Clear filter
                </button>
              )}
            </div>
            
            {/* Hex-style grid of account types */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {accountTypeData.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setAccountTypeFilter(accountTypeFilter === item.name ? null : item.name);
                    setSelectedView('enabled');
                  }}
                  className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                    accountTypeFilter === item.name 
                      ? 'border-blue-500 ring-2 ring-blue-500/30' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  style={{ backgroundColor: getAccountTypeChartColor(item.name) + '20' }}
                >
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                    {item.name}
                  </div>
                  <div className="text-2xl font-bold" style={{ color: getAccountTypeChartColor(item.name) }}>
                    {item.value}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
              Click on a type to filter and show all accounts of that type across all customers
            </p>
          </div>

          {/* FTech Engineer Rankings - Name & Shame */}
            <div className="flex items-center mb-4">
              <AlertTriangle className="mr-2 text-red-500" />
              <h3 className="text-lg font-semibold">FTech Engineer Rankings</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Engineers with most unmaintained AD accounts (stale passwords, never logged in, disabled)
            </p>
            
            {leadEngineerRankings.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leadEngineerRankings.slice(0, 10).map((engineer, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      index === 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                      index === 1 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' :
                      index === 2 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' :
                      'bg-gray-50 dark:bg-gray-700 border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          {index < 3 && (
                            <span className={`text-lg font-bold ${
                              index === 0 ? 'text-red-600' : 
                              index === 1 ? 'text-orange-600' : 'text-yellow-600'
                            }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          )}
                          <span className="font-semibold">{engineer.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{engineer.customer}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">{engineer.unmaintainedScore}</div>
                        <p className="text-xs text-gray-500">risk score</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-orange-600">⏱️ {engineer.stalePasswords} stale</span>
                      <span className="text-red-600">🚫 {engineer.neverLoggedIn} never login</span>
                      <span className="text-gray-600">❌ {engineer.disabled} disabled</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No engineer data available</p>
            )}
          </div>
        </div>

        {/* Second Row - Disabled Accounts Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top 10 Customers with Disabled Accounts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <div className="flex items-center mb-4">
              <UserX className="mr-2 text-orange-500" />
              <h3 className="text-lg font-semibold">Top Customers with Disabled Accounts</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Customers with most accounts disabled by automation
            </p>
            
            {customerDisabledRanking.length > 0 ? (
              <div className="space-y-2">
                {customerDisabledRanking.map((customer, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index < 3 ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="font-medium">{customer.customer}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500">{customer.totalAccounts} total</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        customer.disabledCount > 5 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                        customer.disabledCount > 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {customer.disabledCount} disabled
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No disabled accounts data</p>
            )}
          </div>

          {/* Recently Disabled by Automation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div 
              className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => setIsDisabledAccountsCollapsed(!isDisabledAccountsCollapsed)}
            >
              <h3 className="text-lg font-semibold flex items-center">
                <UserX className="mr-2 text-red-500" />
                Recently Disabled by Automation
              </h3>
              <span className="text-gray-500">{isDisabledAccountsCollapsed ? <ChevronDown /> : <ChevronUp />}</span>
            </div>
            
            {!isDisabledAccountsCollapsed && (
              <div className="max-h-64 overflow-y-auto">
                {disabledThisRun.length > 0 ? (
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Username</th>
                        <th className="px-4 py-2 text-left">Domain</th>
                        <th className="px-4 py-2 text-left">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disabledThisRun.slice(0, 10).map((account, index) => (
                        <tr key={index} className="border-t dark:border-gray-700">
                          <td className="px-4 py-2">{account.Username}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{account.DomainName}</td>
                          <td className="px-4 py-2 text-gray-500 text-sm">{new Date(account.TimeStamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                    <p>No accounts disabled in this period</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {renderAccountList()}

        <AccountDetailsModal 
          account={selectedAccount} 
          onClose={() => setSelectedAccount(null)} 
        />
      </div>
    </div>
  );
};

export default DashboardComponent;
