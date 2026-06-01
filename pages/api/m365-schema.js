import fs from 'fs';
import path from 'path';
export default function handler(req, res) {
  const schemaPath = path.join(process.cwd(), 'config', 'm365-baseline-schema.json');
  if (!fs.existsSync(schemaPath)) return res.status(500).json({ error: 'not found', cwd: process.cwd() });
  res.status(200).json(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}
