import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Download, AlertTriangle, Shield, Clock, UserMinus } from 'lucide-react';
// Replacing shadcn Alert with a custom alert component
const CustomAlert = ({ children, variant = 'default', className = '' }) => {
  const variantStyles = {
    default: 'bg-blue-50 border-blue-200',
    destructive: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200'
  };
  return (
    <div className={`p-4 rounded-lg border ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};

const CustomAlertTitle = ({ children }) => (
  <h5 className="font-medium mb-1">{children}</h5>
);

const CustomAlertDescription = ({ children }) => (
  <div className="text-sm">{children}</div>
);
import Papa from 'papaparse';
import _ from 'lodash';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const RISK_THRESHOLDS = {
  HIGH: 90,
  MEDIUM: 60,
  LOW: 30
};

const DashboardComponent = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('risks');

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await window.fs.readFile('orangegrove.local_RMSRiskMitigation_FtechEng_Report_20241203.csv', { encoding: 'utf8' });
        const parsed = Papa.parse(response, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });
        setData(parsed.data);
        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getDisabledAccountsAnalysis = () => {
    const disabledAccounts = data.filter(row => row.Status === 'Disabled');
    return disabledAccounts.map(acc => ({
      username: acc.Username,
      accountType: acc.AccountType,
      description: acc.Description || 'No description provided',
      lastLogon: new Date(acc.LastLogon).toLocaleDateString(),
      disabledDays: Math.floor((new Date() - new Date(acc.LastLogon)) / (1000 * 60 * 60 * 24)),
      whenDisabled: acc.LastModified || 'Unknown'
    }));
  };

  const getAutoDisabledAccounts = () => {
    return data.filter(row => 
      row.ActionThisRun === 'Disabled' || 
      row.ActionThisRun?.includes('disable')
    ).map(acc => ({
      username: acc.Username,
      accountType: acc.AccountType,
      reason: acc.Description || 'Auto-disabled by security policy',
      timestamp: new Date(acc.TimeStamp).toLocaleString()
    }));
  };

  const getRiskMetrics = () => {
    const domainAdmins = data.filter(account => account.AccountType === 'Domain Admin');
    const enabled = domainAdmins.filter(admin => admin.Status === 'Enabled');
    
    return {
      totalAccounts: data.length,
      domainAdmins: domainAdmins.length,
      enabledAdmins: enabled.length,
      highRiskAdmins: enabled.filter(admin => admin.PasswordAgeInDays > RISK_THRESHOLDS.HIGH).length,
      disabledAccounts: data.filter(acc => acc.Status === 'Disabled').length,
      autoDisabled: data.filter(acc => acc.ActionThisRun === 'Disabled').length
    };
  };

  if (loading) return <div className="p-4">Loading dashboard data...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  const metrics = getRiskMetrics();
  const disabledAnalysis = getDisabledAccountsAnalysis();
  const autoDisabled = getAutoDisabledAccounts();

  return (
    <div className="p-4 space-y-6">
      {/* Tabs */}
      <div className="flex space-x-4 border-b">
        <button 
          className={`pb-2 px-4 ${activeTab === 'risks' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('risks')}
        >
          Risk Analysis
        </button>
        <button 
          className={`pb-2 px-4 ${activeTab === 'disabled' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('disabled')}
        >
          Disabled Accounts
        </button>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-blue-100 rounded-lg">
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6" />
            <h3 className="font-bold">Total Accounts</h3>
          </div>
          <p className="text-2xl">{metrics.totalAccounts}</p>
        </div>
        <div className="p-4 bg-green-100 rounded-lg">
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6" />
            <h3 className="font-bold">Domain Admins</h3>
          </div>
          <p className="text-2xl">{metrics.domainAdmins}</p>
        </div>
        <div className="p-4 bg-yellow-100 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6" />
            <h3 className="font-bold">High Risk</h3>
          </div>
          <p className="text-2xl">{metrics.highRiskAdmins}</p>
        </div>
        <div className="p-4 bg-red-100 rounded-lg">
          <div className="flex items-center space-x-2">
            <UserMinus className="h-6 w-6" />
            <h3 className="font-bold">Disabled</h3>
          </div>
          <p className="text-2xl">{metrics.disabledAccounts}</p>
        </div>
        <div className="p-4 bg-purple-100 rounded-lg col-span-2">
          <div className="flex items-center space-x-2">
            <Clock className="h-6 w-6" />
            <h3 className="font-bold">Auto-Disabled This Run</h3>
          </div>
          <p className="text-2xl">{metrics.autoDisabled}</p>
        </div>
      </div>

      {activeTab === 'risks' ? (
        /* Risk Analysis Content */
        <div className="space-y-6">
          <div className="border rounded-lg p-4 shadow">
            <h3 className="text-lg font-semibold mb-4">High Risk Domain Admin Accounts</h3>
            <div className="overflow-auto max-h-[400px]">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Username</th>
                    <th className="px-4 py-2 text-left">Password Age</th>
                    <th className="px-4 py-2 text-left">Last Logon</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    .filter(acc => acc.AccountType === 'Domain Admin' && acc.PasswordAgeInDays > RISK_THRESHOLDS.MEDIUM)
                    .map((acc, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-4 py-2">{acc.Username}</td>
                        <td className="px-4 py-2">{acc.PasswordAgeInDays} days</td>
                        <td className="px-4 py-2">{new Date(acc.LastLogon).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-white ${
                            acc.PasswordAgeInDays > RISK_THRESHOLDS.HIGH ? 'bg-red-500' : 'bg-yellow-500'
                          }`}>
                            {acc.PasswordAgeInDays > RISK_THRESHOLDS.HIGH ? 'Critical' : 'Warning'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Disabled Accounts Content */
        <div className="space-y-6">
          {autoDisabled.length > 0 && (
            <div className="border rounded-lg p-4 shadow bg-yellow-50">
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                <h3 className="text-lg font-semibold">Accounts Auto-Disabled This Run</h3>
              </div>
              <div className="overflow-auto max-h-[200px]">
                <table className="min-w-full">
                  <thead className="bg-yellow-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Username</th>
                      <th className="px-4 py-2 text-left">Account Type</th>
                      <th className="px-4 py-2 text-left">Reason</th>
                      <th className="px-4 py-2 text-left">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoDisabled.map((acc, idx) => (
                      <tr key={idx} className="border-t border-yellow-200">
                        <td className="px-4 py-2">{acc.username}</td>
                        <td className="px-4 py-2">{acc.accountType}</td>
                        <td className="px-4 py-2">{acc.reason}</td>
                        <td className="px-4 py-2">{acc.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4 shadow">
            <h3 className="text-lg font-semibold mb-4">All Disabled Accounts</h3>
            <div className="overflow-auto max-h-[400px]">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Username</th>
                    <th className="px-4 py-2 text-left">Account Type</th>
                    <th className="px-4 py-2 text-left">Days Since Last Logon</th>
                    <th className="px-4 py-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {disabledAnalysis.map((acc, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-2">{acc.username}</td>
                      <td className="px-4 py-2">{acc.accountType}</td>
                      <td className="px-4 py-2">{acc.disabledDays}</td>
                      <td className="px-4 py-2">{acc.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardComponent;