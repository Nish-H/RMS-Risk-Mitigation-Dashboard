import fs from 'fs';
import path from 'path';

const TRENDS_FILE = path.join(process.cwd(), 'data', 'm365_trends.json');

function loadTrends() {
  if (!fs.existsSync(TRENDS_FILE)) return {};
  return JSON.parse(fs.readFileSync(TRENDS_FILE, 'utf8'));
}

export default function handler(req, res) {
  const { clientId } = req.query;

  if (req.method === 'GET') {
    const trends = loadTrends();
    if (clientId) {
      return res.status(200).json({ trends: trends[clientId] || [] });
    }
    return res.status(200).json({ clients: trends });
  }

  if (req.method === 'POST') {
    const { clientId, clientName, date, overallCompliance, items } = req.body;
    if (!clientId || !date) return res.status(400).json({ error: 'clientId and date required' });

    const trends = loadTrends();
    if (!trends[clientId]) trends[clientId] = [];
    trends[clientId].push({ clientName, date, overallCompliance, items });
    trends[clientId].sort((a, b) => a.date.localeCompare(b.date));
    fs.writeFileSync(TRENDS_FILE, JSON.stringify(trends, null, 2), 'utf8');

    return res.status(200).json({ success: true, trends: trends[clientId] });
  }

  res.status(405).json({ error: 'Method not allowed' });
}