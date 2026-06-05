
import React, { useState, useEffect } from 'react';
import DashboardComponent from '../components/DashboardComponent';
import AdminTools from '../components/AdminTools';
import ComputerDashboard from '../components/ComputerDashboard';
import ADSecureScoreDashboard from '../components/ad-secure-score-dashboard-combined.jsx';
import M365BaselineDashboard from '../components/M365BaselineDashboard';
import Link from 'next/link';
import { LayoutDashboard, Wrench, Shield, Monitor, HardDrive, Cloud, Users, LogIn } from 'lucide-react';

export default function Home() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeUsers, setActiveUsers] = useState(0);

    useEffect(() => {
        const updateUsers = () => {
            const base = 3 + Math.floor(Math.random() * 8);
            const variance = Math.floor(Math.random() * 3) - 1;
            setActiveUsers(Math.max(1, base + variance));
        };
        updateUsers();
        const interval = setInterval(updateUsers, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let visitorId = localStorage.getItem('rms_visitor_id');
        if (!visitorId) {
            visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            localStorage.setItem('rms_visitor_id', visitorId);
        }
        fetch('/api/tracker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitorId,
                page: window.location.pathname,
                referrer: document.referrer || '',
                userAgent: navigator.userAgent
            })
        }).catch(() => {});
    }, []);

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
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                            <Users size={16} className="text-green-300" />
                            <span className="text-sm font-medium">{activeUsers}</span>
                            <span className="text-xs text-blue-200">active</span>
                        </div>
                        <Link
                            href="/ad-security"
                            className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                        >
                            <Shield size={18} />
                            <span>AD Security Assessment</span>
                        </Link>
                        <Link
                            href="/admin"
                            className="flex items-center space-x-1.5 bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400/40 px-3 py-1.5 rounded-lg transition-colors text-sm"
                        >
                            <LogIn size={15} />
                            <span>Admin Login</span>
                        </Link>
                    </div>
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
                        <span>Domain Admins</span>
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
                            activeTab === 'ad-secure-score'
                                ? 'bg-green-500 text-white shadow-lg transform scale-105'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setActiveTab('ad-secure-score')}
                    >
                        <Shield size={20} />
                        <span>AD Secure Score</span>
                    </button>
                    <button
                        className={`flex items-center space-x-2 px-6 py-3 font-bold rounded-t-lg transition-all ${
                            activeTab === 'm365-baselines'
                                ? 'bg-cyan-500 text-white shadow-lg transform scale-105'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setActiveTab('m365-baselines')}
                    >
                        <Cloud size={20} />
                        <span>M365 Security Baselines</span>
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
                </div>
            </div>

            {/* Tab Content */}
            <div className="container mx-auto px-4 pb-6">
                <div className="bg-white dark:bg-gray-800 rounded-b-lg rounded-tr-lg shadow-xl p-4 min-h-screen">
                    {activeTab === 'dashboard' && <DashboardComponent />}
                    {activeTab === 'computers' && <ComputerDashboard />}
                    {activeTab === 'admin-tools' && <AdminTools />}
                    {activeTab === 'ad-secure-score' && <ADSecureScoreDashboard />}
                    {activeTab === 'm365-baselines' && <M365BaselineDashboard />}
                </div>
            </div>
        </div>
    );
}
