import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const DashboardHeader = () => (
  <div className="mb-8">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
      RMS Clients Domain Admin Accs - Risk Mitigation Dashboard
    </h1>
    <div className="h-1 w-32 bg-blue-500 mt-2"></div>
  </div>
);

const DashboardComponent = () => {
  // State declarations - including new searchQuery
  const [data, setData] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [selectedView, setSelectedView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7days');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const jsonData = await response.json();
        setData(jsonData);
        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const exportToCSV = (exportData, filename) => {
    const headers = ['Username', 'DomainName', 'FirstName', 'LastName', 'Status', 'AccountType', 
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

  if (loading) return <div className="p-4">Loading dashboard data...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  const customers = ['All', ...new Set(data.map(item => item.Customer))].sort();
  const filteredData = selectedCustomer === 'All' 
    ? data 
    : data.filter(item => item.Customer === selectedCustomer);

  const enabledAccounts = filteredData.filter(item => item.Status === 'Enabled');
  const disabledAccounts = filteredData.filter(item => item.Status === 'Disabled');
  const disabledThisRun = filteredData.filter(item => item.ActionThisRun === 'Disabled');

  // Account Type Distribution
  const accountTypeData = Object.entries(
    filteredData.reduce((acc, item) => {
      acc[item.AccountType] = (acc[item.AccountType] || 0) + 1;
      return acc;
    }, {})
  ).map(([type, count]) => ({ name: type, value: count }));

  // Password Age Distribution
  const passwordAgeData = filteredData.reduce((acc, item) => {
    const age = parseInt(item.PasswordAgeInDays);
    if (age < 30) acc['0-30']++;
    else if (age < 60) acc['31-60']++;
    else if (age < 90) acc['61-90']++;
    else acc['90+']++;
    return acc;
  }, { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 });

  // Last Login Analysis
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

  const TableHeader = ({ label, sortKey }) => (
    <th 
      className="px-4 py-2 cursor-pointer hover:bg-gray-100"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {sortConfig.key === sortKey && (
          <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
        )}
      </div>
    </th>
  );

  const renderAccountList = () => {
    let accounts = [];
    let title = '';

    // Handle search input changes
    const handleSearch = (e) => {
      setSearchQuery(e.target.value);
    };

    if (selectedView === 'enabled') {
      accounts = enabledAccounts;
      title = 'Enabled Accounts';
    } else if (selectedView === 'disabled') {
      accounts = disabledAccounts;
      title = 'Disabled Accounts';
    } else {
      return null;
    }

    // Apply search filter if search query exists
    if (searchQuery.trim()) {
      accounts = accounts.filter(account => 
        account.Username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    if (sortConfig.key) {
      accounts = [...accounts].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) 
          return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) 
          return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return (
      <div className="mt-4 border rounded-lg p-4 bg-white shadow">
        <div className="flex justify-between items-center mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={handleSearch}
                className="w-64 p-2 border rounded shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <button 
            onClick={() => exportToCSV(accounts, title.replace(' ', '_'))}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>

        <div className="overflow-auto max-h-96">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <TableHeader label="Username" sortKey="Username" />
                <TableHeader label="Domain" sortKey="DomainName" />
                <TableHeader label="Full Name" sortKey="FirstName" />
                <TableHeader label="Account Type" sortKey="AccountType" />
                <TableHeader label="Last Logon" sortKey="LastLogon" />
                <TableHeader label="Password Last Set" sortKey="PasswordLastSet" />
                <TableHeader label="Password Age (Days)" sortKey="PasswordAgeInDays" />
                <TableHeader label="Description" sortKey="Description" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{account.Username}</td>
                  <td className="px-4 py-2">{account.DomainName}</td>
                  <td className="px-4 py-2">{`${account.FirstName || ''} ${account.LastName || ''}`}</td>
                  <td className="px-4 py-2">{account.AccountType}</td>
                  <td className="px-4 py-2">{new Date(account.LastLogon).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{new Date(account.PasswordLastSet).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{account.PasswordAgeInDays}</td>
                  <td className="px-4 py-2">{account.Description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <DashboardHeader />
      
      <div className="mb-6">
        <select 
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className="p-2 border rounded shadow-sm w-64"
        >
          {customers.map(customer => (
            <option key={customer} value={customer}>{customer}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div 
          className="p-4 bg-blue-100 rounded-lg cursor-pointer hover:bg-blue-200"
          onClick={() => setSelectedView(null)}
        >
          <h3 className="font-bold">Total Accounts</h3>
          <p className="text-2xl">{filteredData.length}</p>
        </div>
        <div 
          className="p-4 bg-green-100 rounded-lg cursor-pointer hover:bg-green-200"
          onClick={() => setSelectedView('enabled')}
        >
          <h3 className="font-bold">Enabled Accounts</h3>
          <p className="text-2xl">{enabledAccounts.length}</p>
        </div>
        <div 
          className="p-4 bg-red-100 rounded-lg cursor-pointer hover:bg-red-200"
          onClick={() => setSelectedView('disabled')}
        >
          <h3 className="font-bold">Disabled Accounts</h3>
          <p className="text-2xl">{disabledAccounts.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="border rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-4">Account Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={accountTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-4">Password Age Risk Distribution</h3>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(passwordAgeData).map(([range, count]) => (
              <div 
                key={range}
                className={`p-4 rounded-lg text-white ${
                  range === '0-30' ? 'bg-green-500' :
                  range === '31-60' ? 'bg-yellow-500' :
                  range === '61-90' ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
              >
                <div className="font-bold">{range} days</div>
                <div className="text-2xl">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="border rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-4">Last Login Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
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
                outerRadius={80}
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

        <div className="border rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-4">Latest Accs Disabled by Mitigation Script</h3>
          <div className="overflow-auto max-h-[300px]">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2">Username</th>
                  <th className="px-4 py-2">Domain</th>
                  <th className="px-4 py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {disabledThisRun.map((account, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2">{account.Username}</td>
                    <td className="px-4 py-2">{account.DomainName}</td>
                    <td className="px-4 py-2">{new Date(account.TimeStamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {renderAccountList()}
    </div>
  );
}
export default DashboardComponent;