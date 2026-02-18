import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

const ComputerHistoricalTrendWidget = ({ data, customer }) => {
  if (!data || data.length === 0 || customer === 'All') return null;

  // Filter for customer
  const customerData = data.filter(item => item.Customer === customer);

  // Group by date
  const trendsByDate = customerData.reduce((acc, item) => {
    let dateStr = '';
    if (item.TimeStamp) {
      dateStr = item.TimeStamp.split(' ')[0];
    } else if (item.ReportDate) {
      dateStr = item.ReportDate;
    } else {
      return acc;
    }

    if (!acc[dateStr]) {
      acc[dateStr] = { date: dateStr, stale: 0, disabled: 0, total: 0 };
    }

    acc[dateStr].total++;

    if (item.Status === 'Disabled') {
      acc[dateStr].disabled++;
    }

    // Stale/High Risk
    if (item.RiskLevel === 'Critical' || item.RiskLevel === 'High' || (item.LastLogonAgeDays > 90 && item.Status === 'Enabled')) {
      acc[dateStr].stale++;
    }

    return acc;
  }, {});

  const trendData = Object.values(trendsByDate).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (trendData.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <TrendingUp className="mr-2 text-blue-500" />
        Computer Clean-up Trend - {customer}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="stale" name="Stale/High Risk" stroke="#F59E0B" strokeWidth={2} />
            <Line type="monotone" dataKey="disabled" name="Disabled" stroke="#EF4444" strokeWidth={2} />
            <Line type="monotone" dataKey="total" name="Total Objects" stroke="#3B82F6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Tracking reduction in stale and disabled computer accounts
      </p>
    </div>
  );
};

export default ComputerHistoricalTrendWidget;
