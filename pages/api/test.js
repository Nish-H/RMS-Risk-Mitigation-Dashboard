import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.csv'));
    
    const fileContents = files.map(file => {
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const firstLine = content.split('\n')[0];
      return {
        name: file,
        size: fs.statSync(filePath).size,
        headerSample: firstLine
      };
    });

    res.status(200).json({
      message: 'Test endpoint working',
      files: fileContents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}