import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Download, Search, Filter } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const formatCustomerName = (domainName) => {
  if (domainName === 'All') return 'All Customers';
  
  // Remove .local, .co.za, etc and convert to proper case
  let customerName = domainName
    .split('.')[0]  // Take first part before any dots
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .trim();
  
  // Handle special cases where domain starts with numeric or other characters
  customerName = customerName.charAt(0).toUpperCase() + customerName.slice(1);
  
  // Convert specific abbreviations
  const abbreviations = {
    'Rms': 'RMS',
    'Ntt': 'NTT',
    'Ibm': 'IBM',
  };
  
  // Replace any known abbreviations
  Object.entries(abbreviations).forEach(([abbr, replacement]) => {
    customerName = customerName.replace(abbr, replacement);
  });
  
  return customerName;
};

const DashboardHeader = () => (
  <div className="mb-4">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
      RMS Clients Domain Admin Accs - Risk Mitigation Dashboard
    </h1>
    <div className="h-1 w-32 bg-blue-500 mt-2"></div>
  </div>
);

const SearchBar = ({ searchQuery, setSearchQuery, placeholder }) => (
  <div className="relative">
    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
    <input
      type="text"
      placeholder={placeholder}
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="pl-10 pr-4 py-2 w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

const FilterSection = ({ 
  selectedCustomer, 
  customers, 
  onCustomerChange, 
  timeRange, 
  onTimeRangeChange,
  passwordRiskLevel,
  onPasswordRiskLevelChange,
  isDomainAdmin,
  onDomainAdminChange,
  passwordStatus,
  onPasswordStatusChange
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap gap-3">
      <select 
        value={selectedCustomer}
        onChange={onCustomerChange}
        className="p-2 border rounded-md shadow-sm w-48"
      >
        {customers.map(customer => (
          <option key={customer.domain} value={customer.domain}>
            {customer.domain === 'All' ? 'All Customers' : customer.name}
          </option>
        ))}
      </select>
      <select
        value={timeRange}
        onChange={onTimeRangeChange}
        className="p-2 border rounded-md shadow-sm w-36"
      >
        <option value="7days">Last 7 Days</option>
        <option value="30days">Last 30 Days</option>
        <option value="90days">Last 90 Days</option>
        <option value="all">All Time</option>
      </select>
    </div>
    
    <div className="flex flex-wrap gap-3">
      <select
        value={passwordRiskLevel}
        onChange={onPasswordRiskLevelChange}
        className="p-2 border rounded-md shadow-sm w-36"
      >
        <option value="all">All Risk Levels</option>
        <option value="High">High Risk</option>
        <option value="Medium">Medium Risk</option>
        <option value="Low">Low Risk</option>
      </select>
      
      <select
        value={passwordStatus}
        onChange={onPasswordStatusChange}
        className="p-2 border rounded-md shadow-sm w-36"
      >
        <option value="all">All Password Status</option>
        <option value="Expired">Expired</option>
        <option value="Active">Active</option>
        <option value="NeverExpires">Never Expires</option>
      </select>
    </div>
    
    <div className="flex items-center gap-3">
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={isDomainAdmin === true}
          onChange={(e) => onDomainAdminChange(e.target.checked)}
          className="form-checkbox h-4 w-4 text-blue-600"
        />
        <span className="text-sm">Domain Admin Only</span>
      </label>
    </div>
  </div>
);

const MetricCard = ({ title, value, bgColor, onClick, selected }) => (
  <div 
    onClick={onClick}
    className={`p-3 ${bgColor} rounded-lg cursor-pointer transition-all duration-200 ${
      selected ? 'ring-2 ring-blue-500' : ''
    }`}
  >
    <h3 className="text-sm font-bold">{title}</h3>
    <p className="text-xl">{value}</p>
  </div>
);

const DashboardComponent = () => {
  const [data, setData] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [selectedView, setSelectedView] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [passwordRiskLevel, setPasswordRiskLevel] = useState('all');
  const [passwordStatus, setPasswordStatus] = useState('all');
  const [isDomainAdmin, setIsDomainAdmin] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);

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

  // Extract unique domain names and format them for customer filter
  const customers = ['All', ...new Set(data.map(item => ({
    domain: item.DomainName,
    name: formatCustomerName(item.DomainName)
  })))].sort((a, b) => a.name.localeCompare(b.name));

  const filterData = (accounts) => {
    return accounts.filter(account => {
      // Search filter
      const searchMatch = 
        account.Username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.DomainName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${account.FirstName} ${account.LastName}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Password risk level filter
      const riskMatch = passwordRiskLevel === 'all' || account.PasswordRiskLevel === passwordRiskLevel;
      
      // Password status filter
      const statusMatch = passwordStatus === 'all' || account.PasswordStatus === passwordStatus;
      
      // Domain admin filter
      const adminMatch = !isDomainAdmin || account.IsDomainAdmin === "True";
      
      return searchMatch && riskMatch && statusMatch && adminMatch;
    });
  };

  const filteredData = selectedCustomer === 'All' 
    ? data 
    : data.filter(item => item.DomainName === selectedCustomer);

  const enabledAccounts = filteredData.filter(item => item.Status === 'Enabled');
  const disabledAccounts = filteredData.filter(item => item.Status === 'Disabled');
  const disabledThisRun = filteredData.filter(item => item.ActionThisRun === 'Disabled');

  if (loading) return <div className="p-4">Loading dashboard data...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="p-4">
      <DashboardHeader />
      
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column - Filters and Summary */}
        <div className="col-span-12 md:col-span-3">
          <div className="space-y-4">
            <FilterSection 
              selectedCustomer={selectedCustomer}
              customers={customers}
              onCustomerChange={(e) => setSelectedCustomer(e.target.value)}
              timeRange={timeRange}
              onTimeRangeChange={(e) => setTimeRange(e.target.value)}
              passwordRiskLevel={passwordRiskLevel}
              onPasswordRiskLevelChange={(e) => setPasswordRiskLevel(e.target.value)}
              isDomainAdmin={isDomainAdmin}
              onDomainAdminChange={setIsDomainAdmin}
              passwordStatus={passwordStatus}
              onPasswordStatusChange={(e) => setPasswordStatus(e.target.value)}
            />
            
            <div className="space-y-2">
              <MetricCard
                title="Total Accounts"
                value={filteredData.length}
                bgColor="bg-blue-100 hover:bg-blue-200"
                onClick={() => setSelectedView(null)}
                selected={selectedView === null}
              />
              <MetricCard
                title="Enabled Accounts"
                value={enabledAccounts.length}
                bgColor="bg-green-100 hover:bg-green-200"
                onClick={() => setSelectedView('enabled')}
                selected={selectedView === 'enabled'}
              />
              <MetricCard
                title="Disabled Accounts"
                value={disabledAccounts.length}
                bgColor="bg-red-100 hover:bg-red-200"
                onClick={() => setSelectedView('disabled')}
                selected={selectedView === 'disabled'}
              />
            </div>
          </div>
        </div>

        {/* Middle Column - Main Content */}
        <div className="col-span-12 md:col-span-6">
          {selectedView && (
            <div className="mb-4">
              <SearchBar 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                placeholder="Search by username, domain, or name..."
              />
            </div>
          )}
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="border rounded-lg p-4 bg-white shadow">
                <h3 className="text-lg font-semibold mb-4">Account Type Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Domain Admin', value: filteredData.filter(d => d.IsDomainAdmin === "True").length },
                    { name: 'Standard User', value: filteredData.filter(d => d.IsDomainAdmin === "False").length }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="border rounded-lg p-4 bg-white shadow">
                <h3 className="text-lg font-semibold mb-4">Password Risk Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'High Risk', value: filteredData.filter(d => d.PasswordRiskLevel === 'High').length },
                        { name: 'Medium Risk', value: filteredData.filter(d => d.PasswordRiskLevel === 'Medium').length },
                        { name: 'Low Risk', value: filteredData.filter(d => d.PasswordRiskLevel === 'Low').length }
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
            </div>
          </div>
        </div>

        {/* Right Column - Account Lists */}
        <div className="col-span-12 md:col-span-3">
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-white shadow">
              <h3 className="text-lg font-semibold mb-4">Recently Disabled Accounts</h3>
              <div className="overflow-auto max-h-[300px]">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-sm">Username</th>
                      <th className="px-2 py-2 text-sm">Domain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disabledThisRun.slice(0, 5).map((account, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-2 py-2 text-sm">{account.Username}</td>
                        <td className="px-2 py-2 text-sm">{formatCustomerName(account.DomainName)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedView && (
              <div className="border rounded-lg p-4 bg-white shadow">
                <h3 className="text-lg font-semibold mb-4">
                  {selectedView === 'enabled' ? 'Enabled' : 'Disabled'} Accounts
                </h3>
                <div className="overflow-auto max-h-[400px]">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-sm">Username</th>
                        <th className="px-2 py-2 text-sm">Domain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filterData(selectedView === 'enabled' ? enabledAccounts : disabledAccounts)
                        .map((account, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-2 py-2 text-sm">{account.Username}</td>
                            <td className="px-2 py-2 text-sm">{account.DomainName}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardComponent;
