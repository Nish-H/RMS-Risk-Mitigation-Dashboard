import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const ActiveDirectorySecurityReport = () => {
    // Password Age Distribution Data
    const passwordAgeDistributionData = [
        { name: 'Critical (>5000 days)', value: 80, color: '#FF0000' },
        { name: 'Severe (1000-5000 days)', value: 48, color: '#FF6600' },
        { name: 'High (365-999 days)', value: 19, color: '#FFCC00' },
        { name: 'Medium (180-364 days)', value: 10, color: '#FFFF00' },
        { name: 'Low (90-179 days)', value: 3, color: '#99CC00' },
        { name: 'Compliant (<90 days)', value: 340, color: '#009900' }
    ];

    // Top 10 Domains by Risk Score
    const domainRiskData = [
        { name: 'JGI-MS.co.za', riskScore: 206, criticalAccounts: 13, severeAccounts: 8, highRiskAccounts: 5 },
        { name: 'marriott.local', riskScore: 191, criticalAccounts: 19, severeAccounts: 9, highRiskAccounts: 4 },
        { name: 'swiftair.local', riskScore: 175, criticalAccounts: 13, severeAccounts: 8, highRiskAccounts: 2 },
        { name: 'jonssonworkwear.net', riskScore: 125, criticalAccounts: 11, severeAccounts: 6, highRiskAccounts: 0 },
        { name: 'sgm.local', riskScore: 103, criticalAccounts: 8, severeAccounts: 5, highRiskAccounts: 3 },
        { name: 'lendcor.group', riskScore: 86, criticalAccounts: 6, severeAccounts: 5, highRiskAccounts: 1 },
        { name: 'DurbanSpa.local', riskScore: 48, criticalAccounts: 4, severeAccounts: 0, highRiskAccounts: 4 },
        { name: 'nbi.local', riskScore: 30, criticalAccounts: 3, severeAccounts: 0, highRiskAccounts: 0 },
        { name: 'EAHS.local', riskScore: 25, criticalAccounts: 2, severeAccounts: 1, highRiskAccounts: 0 },
        { name: 'contour.lan', riskScore: 20, criticalAccounts: 1, severeAccounts: 2, highRiskAccounts: 0 }
    ];

    // Top 10 Oldest Passwords
    const oldestPasswordsData = [
        { name: '_Service@swiftair.local', age: 9158 },
        { name: 'nable@sgm.local', age: 8933 },
        { name: 'service-sql@sgm.local', age: 8908 },
        { name: 'svc-azure@nbi.local', age: 8806 },
        { name: 'service-sql@marriott.local', age: 8612 },
        { name: 'sam@DurbanSpa.local', age: 8577 },
        { name: 'service-rapid@marriott.local', age: 8571 },
        { name: 'service-nable@swiftair.local', age: 8553 },
        { name: 'sam@lendcor.group', age: 8465 },
        { name: 'service-sql@jonssonworkwear.net', age: 8417 }
    ];

    // Account Type Distribution by Password Age
    const accountTypeData = [
        {
            name: 'Domain Admin',
            critical: 70,
            severe: 43,
            high: 15,
            medium: 9,
            low: 2,
            compliant: 303
        },
        {
            name: 'FTech Engineer',
            critical: 10,
            severe: 5,
            high: 4,
            medium: 1,
            low: 1,
            compliant: 37
        }
    ];

    // Service Account Analysis
    const serviceAccountAnalysis = {
        total: 191,
        criticalPasswordAge: 40,
        severePasswordAge: 17,
        highRiskPasswordAge: 6,
        averagePasswordAge: 1778
    };

    // Key Recommendations
    const recommendations = [
        {
            priority: "Critical",
            title: "Immediate Password Reset for Critical Accounts",
            finding: "80 accounts have passwords older than 5000 days (13.7 years)",
            impact: "These accounts represent an extreme security vulnerability and may have been compromised without detection",
            recommendation: "Implement immediate password rotation with strong, unique passwords. Create a dedicated task force to address these accounts within 7 days."
        },
        {
            priority: "High",
            title: "Service Account Password Management",
            finding: "57 service accounts have passwords older than 1000 days",
            impact: "Service accounts often have elevated privileges and are high-value targets for attackers",
            recommendation: "Implement a Privileged Access Management (PAM) solution for automated service account rotation and monitoring"
        },
        {
            priority: "High",
            title: "Domain Admin Protection",
            finding: "113 Domain Admin accounts have passwords older than 1000 days",
            impact: "Compromise of Domain Admin accounts can lead to complete network takeover",
            recommendation: "Implement Just-In-Time (JIT) access for Domain Admin privileges, with time-limited access and MFA requirements"
        },
        {
            priority: "Medium",
            title: "Password Policy Enforcement",
            finding: "Only 340 accounts (68.00%) comply with a 90-day password rotation policy",
            impact: "Weak password policies significantly increase the risk of credential-based attacks",
            recommendation: "Implement a maximum password age policy of 90 days for user accounts and 180 days for service accounts, with enforcement through Group Policy"
        },
        {
            priority: "Medium",
            title: "Domain Controller Security",
            finding: "JGI-MS.co.za domain controller accounts have particularly old passwords, averaging over 5000 days",
            impact: "Domain controllers are the most critical infrastructure in the AD environment",
            recommendation: "Prioritize password rotation and security hardening for all domain controller accounts"
        }
    ];

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Active Directory Security Assessment</h1>
                <p className="text-lg text-gray-600">Analysis of password age and account security risks - March 20, 2025</p>
            </div>

            {/* Executive Summary */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Executive Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                        <h3 className="font-semibold text-red-800">Critical Risk</h3>
                        <p className="text-4xl font-bold text-red-700">80</p>
                        <p className="text-sm text-red-600">Accounts with passwords older than 5000 days</p>
                    </div>
                    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                        <h3 className="font-semibold text-orange-800">High Risk</h3>
                        <p className="text-4xl font-bold text-orange-700">67</p>
                        <p className="text-sm text-orange-600">Accounts with passwords 365-5000 days old</p>
                    </div>
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                        <h3 className="font-semibold text-green-800">Compliant</h3>
                        <p className="text-4xl font-bold text-green-700">68%</p>
                        <p className="text-sm text-green-600">Accounts with passwords less than 90 days old</p>
                    </div>
                </div>

                <div className="mt-6 text-gray-700">
                    <p className="mb-2">The analysis of 500 Active Directory accounts across multiple domains reveals significant security concerns:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>16% of all accounts have passwords older than 5000 days (13.7+ years)</li>
                        <li>JGI-MS.co.za appears to be the highest risk domain with multiple legacy accounts</li>
                        <li>Domain controller accounts have an average password age of 5676 days (15.5 years)</li>
                        <li>Service accounts pose particular risk with 21% having critical password ages</li>
                    </ul>
                </div>
            </div>

            {/* Password Age Distribution Chart */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Password Age Distribution</h2>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={passwordAgeDistributionData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                                {passwordAgeDistributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} accounts`, 'Count']} />
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Domain Risk Assessment */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Domain Risk Assessment</h2>
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={domainRiskData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar name="Critical Accounts" dataKey="criticalAccounts" stackId="a" fill="#FF0000" />
                            <Bar name="Severe Accounts" dataKey="severeAccounts" stackId="a" fill="#FF6600" />
                            <Bar name="High Risk Accounts" dataKey="highRiskAccounts" stackId="a" fill="#FFCC00" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4">
                    <p className="font-semibold text-gray-700">Risk Score Formula:</p>
                    <p className="text-gray-600 text-sm">Risk Score = (Critical Accounts × 10) + (Severe Accounts × 5) + (High Risk Accounts × 2) + (Average Password Age ÷ 100)</p>
                </div>
            </div>

            {/* Top 10 Oldest Passwords */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Top 10 Oldest Passwords</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-2 px-4 border-b border-gray-200 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rank</th>
                                <th className="py-2 px-4 border-b border-gray-200 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Account</th>
                                <th className="py-2 px-4 border-b border-gray-200 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Password Age (Days)</th>
                                <th className="py-2 px-4 border-b border-gray-200 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Password Age (Years)</th>
                                <th className="py-2 px-4 border-b border-gray-200 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Risk Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {oldestPasswordsData.map((account, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="py-2 px-4 border-b border-gray-200">{index + 1}</td>
                                    <td className="py-2 px-4 border-b border-gray-200 font-medium">{account.name}</td>
                                    <td className="py-2 px-4 border-b border-gray-200">{account.age.toLocaleString()}</td>
                                    <td className="py-2 px-4 border-b border-gray-200">{(account.age / 365).toFixed(1)}</td>
                                    <td className="py-2 px-4 border-b border-gray-200">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                            Critical
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Account Type Analysis */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Account Type Analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-xl font-bold text-gray-700 mb-3">Domain Admin Accounts</h3>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-gray-500 text-sm">Total</p>
                                    <p className="text-2xl font-bold text-gray-700">442</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Avg. Password Age</p>
                                    <p className="text-2xl font-bold text-gray-700">1,428 days</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Critical Risk</p>
                                    <p className="text-2xl font-bold text-red-600">15.8%</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Compliance Rate</p>
                                    <p className="text-2xl font-bold text-green-600">68.6%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-700 mb-3">Service Accounts</h3>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-gray-500 text-sm">Total</p>
                                    <p className="text-2xl font-bold text-gray-700">191</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Avg. Password Age</p>
                                    <p className="text-2xl font-bold text-gray-700">1,778 days</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Critical Risk</p>
                                    <p className="text-2xl font-bold text-red-600">20.9%</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">Compliance Rate</p>
                                    <p className="text-2xl font-bold text-green-600">67.0%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-8 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={accountTypeData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            layout="vertical"
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={150} />
                            <Tooltip />
                            <Legend />
                            <Bar name="Critical (>5000 days)" dataKey="critical" stackId="a" fill="#FF0000" />
                            <Bar name="Severe (1000-5000 days)" dataKey="severe" stackId="a" fill="#FF6600" />
                            <Bar name="High (365-999 days)" dataKey="high" stackId="a" fill="#FFCC00" />
                            <Bar name="Medium (180-364 days)" dataKey="medium" stackId="a" fill="#FFFF00" />
                            <Bar name="Low (90-179 days)" dataKey="low" stackId="a" fill="#99CC00" />
                            <Bar name="Compliant (<90 days)" dataKey="compliant" stackId="a" fill="#009900" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Key Recommendations */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Key Recommendations</h2>
                <div className="space-y-6">
                    {recommendations.map((rec, index) => (
                        <div
                            key={index}
                            className={`border-l-4 p-4 rounded-md ${rec.priority === 'Critical' ? 'border-red-500 bg-red-50' :
                                rec.priority === 'High' ? 'border-orange-500 bg-orange-50' :
                                    'border-yellow-500 bg-yellow-50'}`}
                        >
                            <div className="flex justify-between items-start">
                                <h3 className="text-lg font-bold">{rec.title}</h3>
                                <span
                                    className={`px-2 py-1 text-xs font-bold rounded-full ${rec.priority === 'Critical' ? 'bg-red-200 text-red-800' :
                                        rec.priority === 'High' ? 'bg-orange-200 text-orange-800' :
                                            'bg-yellow-200 text-yellow-800'}`}
                                >
                                    {rec.priority}
                                </span>
                            </div>
                            <p className="mt-2 text-gray-700 font-medium">Finding: {rec.finding}</p>
                            <p className="mt-1 text-gray-700">Impact: {rec.impact}</p>
                            <p className="mt-1 text-gray-700">Recommendation: {rec.recommendation}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Best Practices */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Best Practices for AD Password Security</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 border rounded-lg border-blue-200 bg-blue-50">
                        <h3 className="text-lg font-bold text-blue-800 mb-2">Password Policies</h3>
                        <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Enforce maximum password age: 90 days for users, 180 days for service accounts
                            </li>
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Require 14+ character passwords with complexity requirements
                            </li>
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Implement account lockout policies after failed attempts
                            </li>
                        </ul>
                    </div>
                    <div className="p-4 border rounded-lg border-purple-200 bg-purple-50">
                        <h3 className="text-lg font-bold text-purple-800 mb-2">Privileged Access Management</h3>
                        <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-purple-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Deploy Just-In-Time (JIT) admin access with automatic revocation
                            </li>
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-purple-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Implement tiered admin model separating workstation and server admins
                            </li>
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-purple-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Use Privileged Access Workstations (PAWs) for admin tasks
                            </li>
                        </ul>
                    </div>
                    <div className="p-4 border rounded-lg border-green-200 bg-green-50">
                        <h3 className="text-lg font-bold text-green-800 mb-2">Monitoring & Automation</h3>
                        <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Implement automated password rotation for service accounts
                            </li>
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Weekly reporting on account password ages and compliance
                            </li>
                            <li className="flex items-start">
                                <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Automate detection and alerting for password policy violations
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
