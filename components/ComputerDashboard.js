import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Download, Moon, Sun, Shield, AlertTriangle, CheckCircle, XCircle, Users, Monitor, Laptop, Server, Calendar, Search, RefreshCw, Cpu, HardDrive, Wifi, WifiOff, Clock, Trash2, Eye } from 'lucide-react';
import ComputerHistoricalTrendWidget from './ComputerHistoricalTrendWidget';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#EF4444'];

const SkeletonLoader = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}></div>
);

const StatCard = ({ title, value, icon: Icon, color, onClick, active }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600',
  };

  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl shadow-lg transform transition-all hover:scale-105 cursor-pointer ${active ? 'ring-4 ring-blue-500' : ''} bg-gradient-to-br ${colorClasses[color]} text-white`}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className="bg-white/20 p-3 rounded-lg">
            <Icon size={28} />
          </div>
        </div>
      </div>
    </div>
  );
};

const ComputerTypeWidget = ({ data, onFilterChange, activeFilter }) => {
  const computerTypes = data.reduce((acc, item) => {
    const type = item.ComputerType || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const typeData = Object.entries(computerTypes).map(([name, value]) => ({ name, value }));

  const getTypeColor = (type) => {
    if (type === 'Server') return '#0088FE';
    if (type === 'Laptop') return '#00C49F';
    return '#FFBB28';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Cpu className="mr-2 text-blue-500" />
        Computer Types
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {typeData.map((item, index) => (
          <button
            key={index}
            onClick={() => onFilterChange(activeFilter === item.name ? null : item.name)}
            className={`p-4 rounded-lg border-2 transition-all ${
              activeFilter === item.name 
                ? 'border-blue-500 ring-2 ring-blue-500/30' 
                : 'border-gray-200 dark:border-gray-700'
            }`}
            style={{ backgroundColor: getTypeColor(item.name) + '20' }}
          >
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {item.name === 'Server' ? <Server size={20} className="mx-auto mb-1" /> : 
               item.name === 'Laptop' ? <Laptop size={20} className="mx-auto mb-1" /> :
               <Monitor size={20} className="mx-auto mb-1" />}
              {item.name}
            </div>
            <div className="text-2xl font-bold" style={{ color: getTypeColor(item.name) }}>
              {item.value}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ComputerDetailsModal = ({ computer, onClose }) => {
  if (!computer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold flex items-center">
            <Monitor className="mr-2" />
            Computer Details
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Computer Name</label>
              <p className="font-semibold text-lg">{computer.ComputerName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Type</label>
              <p className="font-semibold">{computer.ComputerType}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className={`font-semibold ${computer.Status === 'Enabled' ? 'text-green-600' : 'text-red-600'}`}>
                {computer.Status}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Risk Level</label>
              <p className={`font-semibold ${
                computer.RiskLevel === 'Critical' ? 'text-red-600' :
                computer.RiskLevel === 'High' ? 'text-orange-600' :
                computer.RiskLevel === 'Medium' ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {computer.RiskLevel}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Last Logon</label>
              <p className="font-semibold">
                {computer.LastLogonDate ? new Date(computer.LastLogonDate).toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Days Since Logon</label>
              <p className="font-semibold">{computer.LastLogonAgeDays || 0}</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-500">Operating System</label>
              <p className="font-semibold">{computer.OperatingSystem || 'Unknown'}</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-500">Description</label>
              <p className="font-semibold">{computer.Description || 'N/A'}</p>
            </div>
          </div>
        </div>
        <div className="p-6 border-t dark:border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const ComputerDashboard = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [data, setData] = useState([]);
  const [latestData, setLatestData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [selectedComputer, setSelectedComputer] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/computers');
        const jsonData = await response.json();
        setData(jsonData);
        
        // Filter for latest data only
        const latestRecords = Object.values(jsonData.reduce((acc, item) => {
          const key = `${item.Customer}-${item.ComputerName}`;
          const itemDate = new Date(item.TimeStamp || item.ReportDate || 0);
          
          if (!acc[key] || itemDate > new Date(acc[key].TimeStamp || acc[key].ReportDate || 0)) {
            acc[key] = item;
          }
          return acc;
        }, {}));
        
        setLatestData(latestRecords);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
    
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark', 'bg-gray-900');
    } else {
      document.body.classList.remove('dark', 'bg-gray-900');
    }
  }, [darkMode]);

  const customers = ['All', ...new Set(data.map(item => item.Customer))].sort();
  
  // Data filtered by customer only (for widgets)
  const customerData = selectedCustomer === 'All' ? latestData : latestData.filter(item => item.Customer === selectedCustomer);
  
  // Data filtered by customer AND active filters (for table and stats)
  let filteredData = customerData;
  
  if (typeFilter) {
    filteredData = filteredData.filter(item => item.ComputerType === typeFilter);
  }
  
  if (searchQuery) {
    filteredData = filteredData.filter(item => 
      item.ComputerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.Description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const totalComputers = customerData.length;
  const enabledComputers = customerData.filter(item => item.Status === 'Enabled').length;
  const disabledComputers = customerData.filter(item => item.Status === 'Disabled').length;
  const staleComputers = customerData.filter(item => item.IsStale === true || item.LastLogonAgeDays > 90).length;
  const servers = customerData.filter(item => item.ComputerType === 'Server').length;
  const endpoints = customerData.filter(item => item.ComputerType !== 'Server').length;

  // Use filteredData for charts if we want them to reflect the type filter, 
  // OR use customerData if we want charts to show distribution regardless of selected type.
  // Usually pie charts should show distribution of the current view, but type widget should show all options.
  
  const riskData = [
    { name: 'Critical', value: filteredData.filter(d => d.RiskLevel === 'Critical').length },
    { name: 'High', value: filteredData.filter(d => d.RiskLevel === 'High').length },
    { name: 'Medium', value: filteredData.filter(d => d.RiskLevel === 'Medium').length },
    { name: 'Low', value: filteredData.filter(d => d.RiskLevel === 'Low').length },
    { name: 'None', value: filteredData.filter(d => d.RiskLevel === 'None').length },
  ].filter(d => d.value > 0);

  const disabledThisRun = customerData.filter(item => item.ActionThisRun === 'Disabled');

  const exportToCSV = () => {
    const headers = ['ComputerName', 'DomainName', 'ComputerType', 'Status', 'LastLogonDate', 'LastLogonAgeDays', 'OperatingSystem', 'Description', 'RiskLevel'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => 
        headers.map(h => JSON.stringify(item[h] || '')).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `computer_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="p-6">
        <SkeletonLoader className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <SkeletonLoader key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
      <div className="p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <HardDrive className="text-yellow-400" size={32} />
                <h1 className="text-2xl md:text-3xl font-bold">AD Computer Objects Dashboard</h1>
              </div>
              <p className="text-indigo-100">Endpoint & Server Inventory Management</p>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30"
            >
              {darkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <StatCard title="Total" value={totalComputers} icon={Monitor} color="blue" />
          <StatCard title="Enabled" value={enabledComputers} icon={Wifi} color="green" onClick={() => setTypeFilter(null)} />
          <StatCard title="Disabled" value={disabledComputers} icon={WifiOff} color="red" />
          <StatCard title="Stale (90+)" value={staleComputers} icon={AlertTriangle} color="yellow" />
          <StatCard title="Servers" value={servers} icon={Server} color="purple" onClick={() => setTypeFilter('Server')} />
          <StatCard title="Endpoints" value={endpoints} icon={Laptop} color="indigo" onClick={() => setTypeFilter('Desktop')} />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Customer</label>
              <select 
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="p-2 border rounded-lg dark:bg-gray-700"
              >
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Search</label>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search computers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 p-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button 
                onClick={exportToCSV}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Download size={18} />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <ComputerTypeWidget 
            data={customerData} 
            onFilterChange={setTypeFilter} 
            activeFilter={typeFilter} 
          />

          <ComputerHistoricalTrendWidget data={data} customer={selectedCustomer} />

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <AlertTriangle className="mr-2 text-orange-500" />
              Risk Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recently Disabled */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Trash2 className="mr-2 text-red-500" />
            Recently Disabled by Automation
          </h3>
          <div className="max-h-64 overflow-y-auto">
            {disabledThisRun.length > 0 ? (
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Computer Name</th>
                    <th className="px-4 py-2 text-left">Domain</th>
                    <th className="px-4 py-2 text-left">Reason</th>
                    <th className="px-4 py-2 text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {disabledThisRun.map((computer, index) => (
                    <tr key={index} className="border-t dark:border-gray-700">
                      <td className="px-4 py-2 font-medium">{computer.ComputerName}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{computer.DomainName}</td>
                      <td className="px-4 py-2 text-red-500 text-sm">Inactive ({computer.LastLogonAgeDays} days)</td>
                      <td className="px-4 py-2 text-gray-500 text-sm">{new Date(computer.TimeStamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                <p>No computers disabled in this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Computers Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold">
              {typeFilter ? `${typeFilter} Computers` : 'All Computers'}
              <span className="text-sm font-normal text-gray-500 ml-2">({filteredData.length} found)</span>
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="min-w-full">
              <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">Computer Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">OS</th>
                  <th className="px-4 py-3 text-left">Last Logon</th>
                  <th className="px-4 py-3 text-left">Days</th>
                  <th className="px-4 py-3 text-left">Risk</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 100).map((computer, index) => (
                  <tr key={index} className="border-t dark:border-gray-700 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {computer.ComputerType === 'Server' ? <Server size={16} className="inline mr-2 text-blue-500" /> :
                       computer.ComputerType === 'Laptop' ? <Laptop size={16} className="inline mr-2 text-green-500" /> :
                       <Monitor size={16} className="inline mr-2 text-gray-500" />}
                      {computer.ComputerName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        computer.ComputerType === 'Server' ? 'bg-blue-100 text-blue-700' :
                        computer.ComputerType === 'Laptop' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {computer.ComputerType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {computer.Status === 'Enabled' ? (
                        <span className="flex items-center text-green-600"><CheckCircle size={16} className="mr-1" /></span>
                      ) : (
                        <span className="flex items-center text-red-600"><XCircle size={16} className="mr-1" /></span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {computer.OperatingSystem?.split(' ').slice(0, 3).join(' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {computer.LastLogonDate ? new Date(computer.LastLogonDate).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${
                        computer.LastLogonAgeDays > 90 ? 'text-red-600' :
                        computer.LastLogonAgeDays > 60 ? 'text-orange-600' :
                        computer.LastLogonAgeDays > 30 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {computer.LastLogonAgeDays || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        computer.RiskLevel === 'Critical' ? 'bg-red-100 text-red-700' :
                        computer.RiskLevel === 'High' ? 'bg-orange-100 text-orange-700' :
                        computer.RiskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {computer.RiskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => setSelectedComputer(computer)}
                        className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredData.length > 100 && (
            <div className="p-4 text-center text-gray-500">
              Showing first 100 of {filteredData.length} computers
            </div>
          )}
        </div>

        <ComputerDetailsModal 
          computer={selectedComputer} 
          onClose={() => setSelectedComputer(null)} 
        />
      </div>
    </div>
  );
};

export default ComputerDashboard;
