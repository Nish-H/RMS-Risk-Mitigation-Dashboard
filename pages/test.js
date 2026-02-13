// pages/test.js
import React, { useEffect, useState } from 'react';

const TestPage = () => {
  const [apiData, setApiData] = useState(null);
  const [mainData, setMainData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Test the test endpoint
    fetch('/api/test')
      .then(res => res.json())
      .then(data => {
        console.log('Test API response:', data);
        setApiData(data);
      })
      .catch(err => {
        console.error('Test API Error:', err);
        setError(err.message);
      });

    // Test the main data endpoint
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        console.log('Main API response:', data);
        setMainData(data);
      })
      .catch(err => {
        console.error('Main API Error:', err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Data Test Page</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-2">Test API Response:</h2>
        {apiData ? (
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(apiData, null, 2)}
          </pre>
        ) : (
          <div>Loading test API data...</div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-2">Main API Response:</h2>
        {mainData ? (
          <div>
            <p className="mb-2">Total Records: {mainData.length}</p>
            <h3 className="font-bold mb-1">First Record Sample:</h3>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(mainData[0], null, 2)}
            </pre>
          </div>
        ) : (
          <div>Loading main API data...</div>
        )}
      </div>
    </div>
  );
};

export default TestPage;