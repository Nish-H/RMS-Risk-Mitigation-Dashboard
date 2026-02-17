import fs from 'fs';
import path from 'path';
import csv from 'csvtojson';

// Load client name fixes
const clientNameFixPath = path.join(process.cwd(), 'RMS_Clients_Name_fix.txt');
let clientNameFix = {};

try {
  if (fs.existsSync(clientNameFixPath)) {
    const fixContent = fs.readFileSync(clientNameFixPath, 'utf-8');
    const lines = fixContent.split('\n').filter(line => line.trim());
    lines.forEach(line => {
      const [domain, displayName] = line.split('=').map(s => s.trim());
      if (domain && displayName) {
        clientNameFix[domain.toLowerCase()] = displayName;
      }
    });
    console.log('Loaded client name fixes:', clientNameFix);
  }
} catch (error) {
  console.error('Error loading client name fixes:', error);
}

// Function to get customer name with fixes applied
function getCustomerName(domainName) {
  if (!domainName) return 'Unknown';
  
  const domainKey = domainName.toLowerCase();
  
  // Check for exact match in fixes
  if (clientNameFix[domainKey]) {
    return clientNameFix[domainKey];
  }
  
  // Fallback: use first part of domain name
  return domainName.split('.')[0].toUpperCase();
}

export default async function handler(req, res) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.csv'));
    console.log('Found files:', files); // Debug log

    let allData = [];
    
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Parse CSV content
      const jsonArray = await csv({
        checkType: true,
        ignoreEmpty: true,
        delimiter: ',',
      }).fromString(fileContent);

      // Add domain info with customer name fix applied
      const processedRecords = jsonArray.map(record => ({
        ...record,
        Customer: getCustomerName(record.DomainName)
      }));

      allData = [...allData, ...processedRecords];
    }

    console.log('Total records processed:', allData.length); // Debug log
    
    if (allData.length === 0) {
      throw new Error('No data processed from CSV files');
    }

    res.status(200).json(allData);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}