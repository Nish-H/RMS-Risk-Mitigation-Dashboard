import fs from 'fs';
import path from 'path';
import csv from 'csvtojson';

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

      // Add domain info
      const processedRecords = jsonArray.map(record => ({
        ...record,
        Customer: record.DomainName?.split('.')[0]?.toUpperCase() || 'Unknown'
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