
import React, { useState } from 'react';
import DashboardComponent from '../components/DashboardComponent';
import AdminTools from '../components/AdminTools';
import Link from 'next/link';

export default function Home() {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-1xl font-bold mb-5">RMS - Preventative Measures ~ contact: NishenH  *Hosted on RMS-WEB01*             *Independent of Power-BI*</h1>
            <div className="mb-4">
                <Link href="/ad-security" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    View AD Security Assessment
                </Link>
            </div>

            {/* Main Tab Navigation */}
            <div className="mt-6 mb-4 border-b-2 border-gray-300">
                <div className="flex space-x-2">
                    <button
                        className={`px-8 py-3 font-bold rounded-t-lg transition-all ${
                            activeTab === 'dashboard'
                                ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        Dashboard
                    </button>
                    <button
                        className={`px-8 py-3 font-bold rounded-t-lg transition-all ${
                            activeTab === 'admin-tools'
                                ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        onClick={() => setActiveTab('admin-tools')}
                    >
                        Admin-Tools
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'dashboard' && <DashboardComponent />}
                {activeTab === 'admin-tools' && <AdminTools />}
            </div>
        </div>
    );
}