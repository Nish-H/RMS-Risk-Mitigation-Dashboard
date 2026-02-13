import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const DashboardHeader = () => (
  <div className="mb-8 border-b pb-4">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
      Elevated Domain Accs - Dashboard
    </h1>
    <div className="h-1 w-32 bg-blue-500 mt-2"></div>
    <div className="text-sm text-gray-500 mt-2">
      Last Updated: {new Date().toLocaleString()}
    </div>
  </div>
);

const DashboardComponent = () => {
  const [data, setData] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [selectedView, setSelectedView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const jsonData = await response.json();
        setData(jsonData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <div className="p-4">Loading dashboard data...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  // Derive customers list from data
  const customers = ['All', ...new Set(data.map(item => item.Customer))].sort();

  // Filter data based on selected customer
  const filteredData = selectedCustomer === 'All' 
    ? data 
    : data.filter(item => item.Customer === selectedCustomer);

  const enabledAccounts = filteredData.filter(item => item.Status === 'Enabled');
  const disabledAccounts = filteredData.filter(item => item.Status === 'Disabled');
  const disabledThisRun = filteredData.filter(item => item.ActionThisRun === 'Disabled');

  // Calculate statistics per run
  const runStats = [...new Set(filteredData.map(item => item.TimeStamp))]
    .sort((a, b) => new Date(b) - new Date(a))
    .map(timestamp => {
      const runData = filteredData.filter(item => item.TimeStamp === timestamp);
      return {
        date: new Date(timestamp).toLocaleDateString(),
        totalDisabled: runData.filter(item => item.ActionThisRun === 'Disabled').length,
        totalProcessed: runData.length,
        highRiskAccounts: runData.filter(item => parseInt(item.PasswordAgeInDays) > 90).length
      };
    });

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

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  // Render account list with sorting
  const renderAccountList = () => {
    let accounts = [];
    let title = '';

    if (selectedView === 'enabled') {
      accounts = enabledAccounts;
      title = 'Enabled Accounts';
    } else if (selectedView === 'disabled') {
      accounts = disabledAccounts;
      title = 'Disabled Accounts';
    } else {
      return null;
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

    return (
      <div className="mt-4 border rounded-lg p-4 bg-white shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
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

  // Disabled accounts counter per run
  const DisabledAccountsCounter = () => (
    <div className="mb-6 bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">Accounts Disabled Per Run</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {runStats.map((run, index) => (
          <div key={index} className="bg-red-50 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-600">{run.date}</div>
            <div className="text-2xl font-bold text-red-600">#{run.totalDisabled}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4">
      <DashboardHeader />
      
      {/* Customer Selection */}
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

      {/* Disabled Accounts Counter */}
      <DisabledAccountsCounter />

      {/* Main Stats Cards */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Account Status Distribution */}
        <div className="border rounded-lg p-4 shadow bg-white">
          <h3 className="text-lg font-semibold mb-4">Account Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Enabled', value: enabledAccounts.length },
                  { name: 'Disabled', value: disabledAccounts.length }
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Password Age Distribution */}
        <div className="border rounded-lg p-4 shadow bg-white">
          <h3 className="text-lg font-semibold mb-4">Password Age Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              {range: '0-30', count: filteredData.filter(d => parseInt(d.PasswordAgeInDays) < 30).length},
              {range: '31-60', count: filteredData.filter(d => parseInt(d.PasswordAgeInDays) >= 30 && parseInt(d.PasswordAgeInDays) < 60).length},
              {range: '61-90', count: filteredData.filter(d => parseInt(d.PasswordAgeInDays) >= 60 && parseInt(d.PasswordAgeInDays) < 90).length},
              {range: '90+', count: filteredData.filter(d => parseInt(d.PasswordAgeInDays) >= 90).length}
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recently Disabled Accounts Table */}
        <div className="border rounded-lg p-4 shadow bg-white">
          <h3 className="text-lg font-semibold mb-4">Recently Disabled Accounts</h3>
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

      {/* Render Account List */}
      {renderAccountList()}
    </div>
  );
};

export default DashboardComponent;