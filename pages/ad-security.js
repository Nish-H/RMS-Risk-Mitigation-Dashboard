// pages/ad-security.js
import React from 'react';
import ActiveDirectorySecurityReport from '../components/ADSecurityDashboard';
import Link from 'next/link';

export default function ADSecurityPage() {  // Make sure this is properly exported
    return (
        <div className="container mx-auto p-4">
            <div className="mb-4">
                <Link href="/" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                    Back to Dashboard
                </Link>
            </div>
            <ActiveDirectorySecurityReport />
        </div>
    );
}