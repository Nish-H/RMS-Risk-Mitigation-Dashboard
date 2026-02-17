import fs from 'fs';
import path from 'path';
import csv from 'csvtojson';

export default async function handler(req, res) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    if (!fs.existsSync(dataDir)) {
      return res.status(200).json([]);
    }

    const files = fs.readdirSync(dataDir).filter(file => 
      file.includes('_ADComputers_') && file.endsWith('.csv')
    );

    let allData = [];
    
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      const jsonArray = await csv({
        checkType: true,
        ignoreEmpty: true,
        delimiter: ',',
      }).fromString(fileContent);

      const processedRecords = jsonArray.map(record => ({
        ...record,
        Customer: record.DomainName?.split('.')[0]?.toUpperCase() || 'Unknown'
      }));

      allData = [...allData, ...processedRecords];
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
