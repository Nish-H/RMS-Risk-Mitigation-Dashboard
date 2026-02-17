import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Moon, Sun, Shield, AlertTriangle, CheckCircle, XCircle, Users, UserCheck, UserX, Search, Building2, User, X, Activity, Eye, ChevronDown, ChevronUp } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#EF4444', '#10B981', '#F97316'];

const StatCard = ({ title, value, icon: Icon, color, onClick, active }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600', green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600', yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600',
  };
  return (
    <div onClick={onClick} className={`relative overflow-hidden rounded-xl shadow-lg transform transition-all hover:scale-105 cursor-pointer ${active ? 'ring-4 ring-blue-500 ring-offset-2' : ''} bg-gradient-to-br ${colorClasses[color]} text-white`}>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className="bg-white/20 p-3 rounded-lg"><Icon size={28} /></div>
        </div>
      </div>
    </div>
  );
};

const getAccountTypeBadge = (accountType) => {
  if (!accountType) return 'bg-gray-100 text-gray-700';
  const type = accountType.toLowerCase();
  if (type.includes('domain admin') || type.includes('enterprise')) return 'bg-red-100 text-red-700';
  if (type.includes('ftech') || type.includes('privileged')) return 'bg-orange-100 text-orange-700';
  if (type.includes('service') || type.includes('svc')) return 'bg-blue-100 text-blue-700';
  if (type.includes('shared') || type.includes('portal')) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

const AccountDetailsModal = ({ account, onClose }) => {
  if (!account) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Account Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm text-gray-500">Username</label><p className="font-semibold">{account.Username}</p></div>
            <div><label className="text-sm text-gray-500">Domain</label><p className="font-semibold">{account.DomainName}</p></div>
            <div><label className="text-sm text-gray-500">Time Stamp</label><p className="font-semibold text-orange-600">{account.TimeStamp}</p></div>
            <div><label className="text-sm text-gray-500">Full Name</label><p className="font-semibold">{account.FirstName} {account.LastName}</p></div>
            <div><label className="text-sm text-gray-500">Status</label><p className={`font-semibold ${account.Status === 'Enabled' ? 'text-green-600' : 'text-red-600'}`}>{account.Status}</p></div>
            <div><label className="text-sm text-gray-500">Type</label><p className="font-semibold">{account.AccountType}</p></div>
            <div><label className="text-sm text-gray-500">Password Age</label><p className="font-semibold">{account.PasswordAgeInDays} days</p></div>
            <div><label className="text-sm text-gray-500">Last Logon</label><p className="font-semibold">{account.LastLogon || 'Never'}</p></div>
            <div className="col-span-2"><label className="text-sm text-gray-500">Description</label><p className="font-semibold">{account.Description || 'N/A'}</p></div>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
        </div>
      </div>
    </div>
  );
};

const LeadEngineerWidget = ({ customer, data }) => {
  if (!customer || customer === 'All') return null;
  
  const customerData = data.filter(item => item.Customer === customer);
  let leadEngineer = null;
  let maxScore = -1;
  
  customerData.forEach(item => {
    if (item.Description && item.Description.toLowerCase().includes('engineer')) {
      const name = `${item.FirstName || ''} ${item.LastName || ''}`.trim() || item.Username;
      let score = 0;
      if (item.Description.toLowerCase().includes('lead')) score += 3;
      if (item.Description.toLowerCase().includes('senior')) score += 2;
      if (item.Description.toLowerCase().includes('principal')) score += 3;
      if (item.Description.toLowerCase().includes('security')) score += 1;
      if (item.Description.toLowerCase().includes('server')) score += 1;
      if (item.Description.toLowerCase().includes('rms')) score += 1;
      
      if (score > maxScore) {
        maxScore = score;
        leadEngineer = { name, description: item.Description, score };
      }
    }
  });
  
  if (!leadEngineer) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Lead Engineer - {customer}</h3>
        <p className="text-gray-500">No lead engineer identified</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center">
        <User className="mr-2 text-blue-500" />
        Lead Engineer - {customer}
      </h3>
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
          {leadEngineer.name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-lg">{leadEngineer.name}</p>
          <p className="text-sm text-gray-500">{leadEngineer.description}</p>
        </div>
      </div>
    </div>
  );
};

const DashboardComponent = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [data, setData] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [selectedView, setSelectedView] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isAccountTypesCollapsed, setIsAccountTypesCollapsed] = useState(false);
  const [accountTypeFilter, setAccountTypeFilter] = useState(null);

  useEffect(() => {
    if (darkMode) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const jsonData = await response.json();
        setData(jsonData);
        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const exportToCSV = (exportData, filename) => {
    const headers = ['Username', 'DomainName', 'TimeStamp', 'FirstName', 'LastName', 'Status', 'AccountType', 'LastLogon', 'PasswordAgeInDays', 'Description'];
    const csvContent = [headers.join(','), ...exportData.map(item => headers.map(h => JSON.stringify(item[h] || '')).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const customers = ['All', ...new Set(data.map(item => item.Customer))].sort();
  
  let filteredData = selectedCustomer === 'All' ? data : data.filter(item => item.Customer === selectedCustomer);
  
  const enabledAccounts = filteredData.filter(item => item.Status === 'Enabled');
  const disabledAccounts = filteredData.filter(item => item.Status === 'Disabled');
  const staleAccounts = enabledAccounts.filter(a => parseInt(a.PasswordAgeInDays) > 90);
  const neverLoggedIn = enabledAccounts.filter(a => !a.LastLogon || a.LastLogon === 'Never');

  const accountTypeData = Object.entries(filteredData.reduce((acc, item) => { const t = item.AccountType || 'Unknown'; acc[t] = (acc[t] || 0) + 1; return acc; }, {}))
    .map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value);

  const passwordAgeData = filteredData.reduce((acc, item) => { const age = parseInt(item.PasswordAgeInDays); if (age < 30) acc['0-30']++; else if (age < 60) acc['31-60']++; else if (age < 90) acc['61-90']++; else acc['90+']++; return acc; }, { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 });

  const leadEngineerRankings = Object.entries(filteredData.reduce((acc, item) => {
    if (item.Description && (item.Description.toLowerCase().includes('engineer'))) {
      const name = `${item.FirstName || ''} ${item.LastName || ''}`.trim() || item.Username;
      if (!acc[name]) acc[name] = { name, stalePasswords: 0, neverLoggedIn: 0, disabled: 0, unmaintainedScore: 0 };
      if (parseInt(item.PasswordAgeInDays) > 90) acc[name].stalePasswords++;
      if (!item.LastLogon) acc[name].neverLoggedIn++;
      if (item.Status === 'Disabled') acc[name].disabled++;
      acc[name].unmaintainedScore = acc[name].stalePasswords * 3 + acc[name].neverLoggedIn * 2 + acc[name].disabled;
    }
    return acc;
  }, {})).map(([n, s]) => s).sort((a, b) => b.unmaintainedScore - a.unmaintainedScore).slice(0, 10);

  const disabledThisRun = filteredData.filter(item => item.ActionThisRun === 'Disabled');

  const getAccountsToShow = () => {
    let accounts = filteredData;
    
    if (accountTypeFilter) {
      accounts = accounts.filter(a => a.AccountType && a.AccountType.toLowerCase().includes(accountTypeFilter.toLowerCase()));
    }
    
    if (selectedView === 'enabled') return accounts.filter(a => a.Status === 'Enabled');
    if (selectedView === 'disabled') return accounts.filter(a => a.Status === 'Disabled');
    if (selectedView === 'stale') return accounts.filter(a => parseInt(a.PasswordAgeInDays) > 90 && a.Status === 'Enabled');
    if (selectedView === 'neverLoggedIn') return accounts.filter(a => !a.LastLogon && a.Status === 'Enabled');
    return accounts;
  };

  const renderAccountList = () => {
    let accounts = getAccountsToShow();
    
    if (searchQuery) {
      accounts = accounts.filter(a => a.Username.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (`${a.FirstName} ${a.LastName}`).toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    if (accounts.length === 0) {
      return (
        <div className="mt-4 border rounded-xl p-12 bg-white dark:bg-gray-800 text-center">
          <Search size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No accounts found</p>
        </div>
      );
    }

    let title = selectedView === 'enabled' ? 'Enabled Accounts' : 
                 selectedView === 'disabled' ? 'Disabled Accounts' : 
                 selectedView === 'stale' ? 'Stale Password Accounts (90+ days)' :
                 selectedView === 'neverLoggedIn' ? 'Never Logged In Accounts' : 'All Accounts';
    
    if (accountTypeFilter) {
      title = `${accountTypeFilter} - ${title}`;
    }

    return (
      <div className="mt-6 border rounded-xl bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-gray-500">{accounts.length} accounts</p>
          </div>
          <div className="flex gap-2">
            {accountTypeFilter && (
              <button 
                onClick={() => {setAccountTypeFilter(null); setSelectedView('all');}}
                className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 flex items-center"
              >
                <XCircle size={16} className="mr-1" /> Clear Filter
              </button>
            )}
            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-700" />
            <button onClick={() => exportToCSV(accounts, title.replace(/ /g, '_'))} className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <Download size={18} className="mr-2" />Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full">
            <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Domain</th>
                <th className="px-4 py-3 text-left">Time Stamp</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last Logon</th>
                <th className="px-4 py-3 text-left">Pwd Age</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.slice(0, 100).map((account, i) => (
                <tr key={i} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedAccount(account)}>
                  <td className="px-4 py-3 font-medium">{account.Username}</td>
                  <td className="px-4 py-3">{account.DomainName}</td>
                  <td className="px-4 py-3 text-orange-600">{account.TimeStamp}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${getAccountTypeBadge(account.AccountType)}`}>{account.AccountType}</span></td>
                  <td className="px-4 py-3">{account.Status === 'Enabled' ? <span className="text-green-600">Enabled</span> : <span className="text-red-600">Disabled</span>}</td>
                  <td className="px-4 py-3">{account.LastLogon ? new Date(account.LastLogon).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3"><span className={parseInt(account.PasswordAgeInDays) > 90 ? 'text-red-600 font-medium' : ''}>{account.PasswordAgeInDays} days</span></td>
                  <td className="px-4 py-3"><button onClick={(e) => { e.stopPropagation(); setSelectedAccount(account); }} className="p-2 text-blue-500 hover:bg-blue-100 rounded"><Eye size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {accounts.length > 100 && <div className="p-4 text-center text-gray-500">Showing first 100 of {accounts.length} accounts</div>}
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className={darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}>
      <div className="p-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Shield className="text-yellow-400" size={32} />
                <h1 className="text-2xl md:text-3xl font-bold">RMS Risk Mitigation Dashboard</h1>
              </div>
              <p className="text-blue-100">FTech Engineer & Domain Admin Accounts</p>
              <div className="flex items-center space-x-4 mt-4 text-sm text-blue-100">
                <span><Building2 size={14} className="inline mr-1" /> Hosted on RMS-WEB01</span>
                <span><Activity size={14} className="inline mr-1" /> Independent of Power-BI</span>
              </div>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="p-3 rounded-full bg-white/20 hover:bg-white/30">
              {darkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <StatCard title="Total" value={filteredData.length} icon={Users} color="blue" onClick={() => setSelectedView('all')} active={selectedView === 'all'} />
          <StatCard title="Enabled" value={enabledAccounts.length} icon={UserCheck} color="green" onClick={() => setSelectedView('enabled')} active={selectedView === 'enabled'} />
          <StatCard title="Disabled" value={disabledAccounts.length} icon={UserX} color="red" onClick={() => setSelectedView('disabled')} active={selectedView === 'disabled'} />
          <StatCard title="Stale (90+)" value={staleAccounts.length} icon={AlertTriangle} color="yellow" onClick={() => setSelectedView('stale')} active={selectedView === 'stale'} />
          <StatCard title="Never Login" value={neverLoggedIn.length} icon={XCircle} color="purple" onClick={() => setSelectedView('neverLoggedIn')} active={selectedView === 'neverLoggedIn'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <label className="block text-sm font-medium mb-2">Customer</label>
            <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700">
              {customers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <LeadEngineerWidget customer={selectedCustomer} data={data} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Account Types</h3>
              <button onClick={() => setIsAccountTypesCollapsed(!isAccountTypesCollapsed)} className="p-1 hover:bg-gray-100 rounded">
                {isAccountTypesCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
            </div>
            {!isAccountTypesCollapsed && (
              <div className="grid grid-cols-2 gap-2">
                {accountTypeData.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (accountTypeFilter === item.name) {
                        setAccountTypeFilter(null);
                        setSelectedView('all');
                      } else {
                        setAccountTypeFilter(item.name);
                        setSelectedView('filtered');
                      }
                    }}
                    className={`p-3 rounded-lg border text-left transition-all hover:scale-105 ${
                      accountTypeFilter === item.name 
                        ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500' 
                        : ''
                    }`}
                    style={{ 
                      borderColor: accountTypeFilter === item.name ? '#3B82F6' : COLORS[i % COLORS.length], 
                      backgroundColor: accountTypeFilter === item.name ? '#DBEAFE' : COLORS[i % COLORS.length] + '20'
                    }}
                  >
                    <div className="text-xs text-gray-600">{item.name}</div>
                    <div className="text-xl font-bold" style={{ color: accountTypeFilter === item.name ? '#1D4ED8' : COLORS[i % COLORS.length] }}>{item.value}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold mb-4">Password Age Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(passwordAgeData).map(([r, c]) => ({ range: r, count: c }))}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="range" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold mb-4 flex items-center"><AlertTriangle className="mr-2 text-red-500" />FTech Engineer Rankings</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {leadEngineerRankings.length > 0 ? leadEngineerRankings.map((e, i) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 ${i === 0 ? 'bg-red-50 border-red-500' : i === 1 ? 'bg-orange-50 border-orange-500' : i === 2 ? 'bg-yellow-50 border-yellow-500' : 'bg-gray-50 border-gray-300'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{e.name}</span>
                    <span className="font-bold text-red-600">{e.unmaintainedScore}</span>
                  </div>
                  <div className="text-xs text-gray-500">Stale: {e.stalePasswords} | Never: {e.neverLoggedIn} | Disabled: {e.disabled}</div>
                </div>
              )) : <p className="text-gray-500 text-center py-4">No engineer data</p>}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold mb-4">Recently Disabled</h3>
            <div className="max-h-64 overflow-y-auto">
              {disabledThisRun.length > 0 ? (
                <table className="min-w-full"><thead className="bg-gray-50 sticky top-0"><tr><th className="px-3 py-2 text-left">Username</th><th className="px-3 py-2 text-left">Domain</th><th className="px-3 py-2 text-left">Time</th></tr></thead>
                <tbody>{disabledThisRun.slice(0, 10).map((a, i) => <tr key={i} className="border-t"><td className="px-3 py-2">{a.Username}</td><td className="px-3 py-2">{a.DomainName}</td><td className="px-3 py-2 text-sm">{a.TimeStamp}</td></tr>)}</tbody></table>
              ) : <p className="text-gray-500 text-center py-4">No accounts disabled</p>}
            </div>
          </div>
        </div>

        {renderAccountList()}
        <AccountDetailsModal account={selectedAccount} onClose={() => setSelectedAccount(null)} />
      </div>
    </div>
  );
};

export default DashboardComponent;
