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
  // State declarations
  const [data, setData] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [selectedView, setSelectedView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7days');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [leadEngineers, setLeadEngineers] = useState({});
  const [currentLeadEngineer, setCurrentLeadEngineer] = useState(null);
  const [passwordAgeFilter, setPasswordAgeFilter] = useState(null);

  const [isPasswordSectionCollapsed, setIsPasswordSectionCollapsed] = useState(false);
  const [isDisabledAccountsCollapsed, setIsDisabledAccountsCollapsed] = useState(false);


  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const jsonData = await response.json();
        setData(jsonData);
        
        // Extract lead engineers from the data
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
  
  // Effect to update current lead engineer when customer selection changes
  useEffect(() => {
    if (selectedCustomer === 'All') {
      setCurrentLeadEngineer(null);
    } else {
      setCurrentLeadEngineer(leadEngineers[selectedCustomer] || null);
    }
  }, [selectedCustomer, leadEngineers]);

  // function to handle clicking on a password age box
  const handlePasswordAgeFilterClick = (range) => {
  // If already selected, clear the filter, otherwise set it
  setPasswordAgeFilter(passwordAgeFilter === range ? null : range);
  // When selecting a password age filter, always show accounts
  if (passwordAgeFilter !== range) {
    setSelectedView('enabled');
  }
};

  // Function to identify the most senior engineer for each customer
  const identifyLeadEngineers = (jsonData) => {
    const engineers = {};
    
    jsonData.forEach(record => {
      if (!record.Description) return;
      
      const description = (typeof record.Description === 'string') ? record.Description.toLowerCase() : '';
      const customer = record.Customer;
      
      if (description && description.includes("engineer")) {
        // Score the engineer based on title keywords
        let score = 0;
        if (description.includes("lead")) score += 3;
        if (description.includes("senior")) score += 2;
        if (description.includes("principal")) score += 3;
        if (description.includes("security")) score += 1;
        if (description.includes("server")) score += 1;
        if (description.includes("rms")) score += 1;
        
        // Store the engineer with their score
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

  const TableHeader = ({ label, sortKey, className = "" }) => (
    <th 
      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${className}`}
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
     // Apply password age filter if active
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
           <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <TableHeader label="Username" sortKey="Username" />
                <TableHeader label="Domain" sortKey="DomainName" />
                <TableHeader label="Time Stamp" sortKey="TimeStamp" className="w-28" />
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
                  <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(account.TimeStamp).toLocaleDateString()} {new Date(account.TimeStamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
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
      
      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
        <div className="flex items-center space-x-4">
          <div>
            <label htmlFor="customer-select" className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select 
              id="customer-select"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="p-2 border rounded shadow-sm w-64"
            >
              {customers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lead Engineer</label>
            <div className="p-2 border rounded shadow-sm bg-gray-50 w-64 min-h-10">
              {currentLeadEngineer ? (
                <div>
                  <div className="font-medium">{currentLeadEngineer.name}</div>
                  <div className="text-sm text-gray-600">{currentLeadEngineer.description}</div>
                </div>
              ) : (
                <span className="text-gray-500 italic">
                  {selectedCustomer === 'All' ? 'Select a customer' : 'No lead engineer identified'}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div 
            className="flex-1 p-4 bg-blue-100 rounded-lg cursor-pointer hover:bg-blue-200"
            onClick={() => setSelectedView(null)}
          >
            <h3 className="font-bold">Total: {filteredData.length}</h3>
          </div>
          <div 
            className="flex-1 p-4 bg-green-100 rounded-lg cursor-pointer hover:bg-green-200"
            onClick={() => setSelectedView('enabled')}
          >
            <h3 className="font-bold">Enabled: {enabledAccounts.length}</h3>
          </div>
          <div 
            className="flex-1 p-4 bg-red-100 rounded-lg cursor-pointer hover:bg-red-200"
            onClick={() => setSelectedView('disabled')}
          >
            <h3 className="font-bold">Disabled: {disabledAccounts.length}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Password Age Risk Distribution - Collapsible */}
        <div className="border rounded-lg p-4 shadow">
          <div 
            className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
            onClick={() => setIsPasswordSectionCollapsed(!isPasswordSectionCollapsed)}
          >
            <h3 className="text-lg font-semibold">Password Age Risk Distribution</h3>
            <span className="text-xl">{isPasswordSectionCollapsed ? '▼' : '▲'}</span>
          </div>
          
          {!isPasswordSectionCollapsed && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {Object.entries(passwordAgeData).map(([range, count]) => (
           <div 
            key={range}
          className={`p-4 rounded-lg text-white cursor-pointer transform transition-transform hover:scale-105 ${
           passwordAgeFilter === range ? 'ring-4 ring-blue-500 ring-offset-2' : ''
          } ${
            range === '0-30' ? 'bg-green-500' :
            range === '31-60' ? 'bg-yellow-500' :
            range === '61-90' ? 'bg-orange-500' :
            'bg-red-500'
         }`}
           onClick={() => handlePasswordAgeFilterClick(range)}
    >   
           <div className="font-bold">{range} days</div>
          <div className="text-2xl">{count}</div>
         </div>
           ))}
         </div>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Last Login Analysis</h3>
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
            </>
          )}
        </div>

        {/* Latest Disabled Accounts - Collapsible */}
        <div className="border rounded-lg p-4 shadow">
          <div 
            className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
            onClick={() => setIsDisabledAccountsCollapsed(!isDisabledAccountsCollapsed)}
          >
            <h3 className="text-lg font-semibold">Latest Accs Disabled by Mitigation Script</h3>
            <span className="text-xl">{isDisabledAccountsCollapsed ? '▼' : '▲'}</span>
          </div>
          
          {!isDisabledAccountsCollapsed && (
            <div className="overflow-auto max-h-[500px]">
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
          )}
        </div>
      </div>


      {renderAccountList()}
    </div>
  );
}

export default DashboardComponent;