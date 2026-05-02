
import React, { useState } from 'react';
import DashboardComponent from '../components/DashboardComponent';
import AdminTools from '../components/AdminTools';
import ComputerDashboard from '../components/ComputerDashboard';
import ADSecureScoreDashboard from '../components/ad-secure-score-dashboard-combined.jsx';
import Link from 'next/link';
import { LayoutDashboard, Wrench, Shield, Monitor, HardDrive } from 'lucide-react';

export default function Home() {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Top Bar */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-800 dark:to-indigo-900 text-white p-4 shadow-lg">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Shield className="text-yellow-400" size={28} />
                        <div>
                            <h1 className="text-xl font-bold">RMS - Preventative Measures</h1>
                            <p className="text-blue-200 text-xs">Contact: NishenH | Hosted on RMS-WEB01 | Independent of Power-BI</p>
                        </div>
                    </div>
                    <Link 
                        href="/ad-security" 
                        className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                    >
                        <Shield size={18} />
                        <span>AD Security Assessment</span>
                    </Link>
                </div>
            </div>

            {/* Main Tab Navigation */}
            <div className="container mx-auto px-4 mt-4">
                <div className="flex space-x-2">
                    <button
                        className={`flex items-center space-x-2 px-6 py-3 font-bold rounded-t-lg transition-all ${
                            activeTab === 'dashboard'
                                ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <LayoutDashboard size={20} />
                        <span>User Dashboard</span>
                    </button>
                    <button
                        className={`flex items-center space-x-2 px-6 py-3 font-bold rounded-t-lg transition-all ${
                            activeTab === 'computers'
                                ? 'bg-purple-500 text-white shadow-lg transform scale-105'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setActiveTab('computers')}
                    >
                        <Monitor size={20} />
                        <span>Computer Objects</span>
                    </button>
                    <button
                        className={`flex items-center space-x-2 px-6 py-3 font-bold rounded-t-lg transition-all ${
                            activeTab === 'admin-tools'
                                ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setActiveTab('admin-tools')}
                    >
                        <Wrench size={20} />
                        <span>Admin-Tools</span>
                    </button>
                    <button
                        className={`flex items-center space-x-2 px-6 py-3 font-bold rounded-t-lg transition-all ${
                            activeTab === 'ad-secure-score'
                                ? 'bg-green-500 text-white shadow-lg transform scale-105'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setActiveTab('ad-secure-score')}
                    >
                        <Shield size={20} />
                        <span>AD Secure Score</span>
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="container mx-auto px-4 pb-6">
                <div className="bg-white dark:bg-gray-800 rounded-b-lg rounded-tr-lg shadow-xl p-4 min-h-screen">
                    {activeTab === 'dashboard' && <DashboardComponent />}
                    {activeTab === 'computers' && <ComputerDashboard />}
                    {activeTab === 'admin-tools' && <AdminTools />}
                    {activeTab === 'ad-secure-score' && <ADSecureScoreDashboard />}
                </div>
            </div>
        </div>
    );
}
