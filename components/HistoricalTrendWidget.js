import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Calendar, AlertTriangle } from 'lucide-react';

const HistoricalTrendWidget = ({ data, customer }) => {
  if (!data || data.length === 0 || customer === 'All') return null;

  // Process data to get historical trends for the selected customer
  const customerData = data.filter(item => item.Customer === customer);
  
  // Group by date (using TimeStamp or ReportDate)
  const trendsByDate = customerData.reduce((acc, item) => {
    // Extract date from TimeStamp (YYYY-MM-DD)
    let dateStr = '';
    if (item.TimeStamp) {
      dateStr = item.TimeStamp.split(' ')[0]; // Assuming "YYYY-MM-DD HH:mm:ss"
    } else if (item.ReportDate) {
      dateStr = item.ReportDate;
    } else {
      return acc; // Skip if no date
    }

    if (!acc[dateStr]) {
      acc[dateStr] = { date: dateStr, highRisk: 0, disabled: 0, total: 0 };
    }

    acc[dateStr].total++;
    
    if (item.Status === 'Disabled') {
      acc[dateStr].disabled++;
    }
    
    if (parseInt(item.PasswordAgeInDays) > 90 && item.Status === 'Enabled') {
      acc[dateStr].highRisk++;
    }

    return acc;
  }, {});

  const trendData = Object.values(trendsByDate).sort((a, b) => new Date(a.date) - new Date(b.date));

  // If we only have 1 data point, we can't show a trend really, but still show the chart
  if (trendData.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <TrendingUp className="mr-2 text-green-500" />
        Historical Risk Trend - {customer}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="highRisk" name="High Risk (90+)" stroke="#F59E0B" strokeWidth={2} />
            <Line type="monotone" dataKey="disabled" name="Disabled Accounts" stroke="#EF4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Tracking reduction in high risk and disabled accounts over time
      </p>
    </div>
  );
};

export default HistoricalTrendWidget;
