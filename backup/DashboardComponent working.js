import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const DashboardComponent = () => {
  const [data, setData] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Fetching data...'); // Debug log
        const response = await fetch('/api/data');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const jsonData = await response.json();
        console.log('Received data:', jsonData?.length, 'records'); // Debug log
        setData(jsonData);
      } catch (error) {
        console.error('Error loading data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="p-4 text-lg">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (!data || data.length === 0) {
    return <div className="p-4">No data available</div>;
  }

  const customers = ['All', ...new Set(data.map(item => item.Customer))].sort();
  const filteredData = selectedCustomer === 'All' 
    ? data 
    : data.filter(item => item.Customer === selectedCustomer);

  // Calculate metrics
  const accountStats = filteredData.reduce((acc, curr) => {
    const status = curr.Status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(accountStats).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="p-4 max-w-7xl mx-auto">
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
        <div className="p-4 bg-blue-100 rounded-lg">
          <h3 className="font-bold">Total Accounts</h3>
          <p className="text-2xl">{filteredData.length}</p>
        </div>
        <div className="p-4 bg-green-100 rounded-lg">
          <h3 className="font-bold">Enabled Accounts</h3>
          <p className="text-2xl">
            {filteredData.filter(item => item.Status === 'Enabled').length}
          </p>
        </div>
        <div className="p-4 bg-red-100 rounded-lg">
          <h3 className="font-bold">Disabled Accounts</h3>
          <p className="text-2xl">
            {filteredData.filter(item => item.Status === 'Disabled').length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-4">Account Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardComponent;