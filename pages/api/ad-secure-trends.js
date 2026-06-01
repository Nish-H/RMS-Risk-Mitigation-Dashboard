import fs from 'fs';
import path from 'path';
import { deriveClientNameFromDomain } from '../../clientNameUtils';

const TRENDS_FILE = 'ad_secure_score_trends.json';

function getTrendsPath() {
  return path.join(process.cwd(), 'ADSecureScoreData', TRENDS_FILE);
}

function getDataDir() {
  return path.join(process.cwd(), 'ADSecureScoreData');
}

// Derive client ID matching the logic in ad-secure-clients.js
function deriveClientId(file, domain) {
  const derivedFromDomain = deriveClientNameFromDomain(domain);
  let clientName = derivedFromDomain || domain;

  if (!clientName) {
    clientName = file.replace(/\.[^/.]+$/, '');
    clientName = clientName.replace(/^ad_secure_score_/, '');
    clientName = clientName.replace(/_ad_secure_score_/g, ' ');
    clientName = clientName.replace(/Shiplakes_College_/i, 'Shiplakes College ');
    clientName = clientName.replace(/_/g, ' ');
    clientName = clientName.replace(/\s+/g, ' ').trim();
  }

  const clientId = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return { clientId, clientName };
}

// Build initial trends from all existing client JSON files
function seedTrendsFromClients() {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) return { clients: {} };

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== TRENDS_FILE);
  const trends = { clients: {} };

  files.forEach(file => {
    try {
      const filePath = path.join(dataDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const domain = content.meta?.domain || '';
      const { clientId, clientName } = deriveClientId(file, domain);
      
      if (!trends.clients[clientId]) {
        trends.clients[clientId] = { name: clientName || domain || file.replace('.json', ''), domain, trends: [] };
      }

      // Collect from history array if present
      if (content.history && Array.isArray(content.history)) {
        content.history.forEach(entry => {
          const exists = trends.clients[clientId].trends.some(t => t.date === entry.date);
          if (!exists) {
            trends.clients[clientId].trends.push({
              date: entry.date,
              overallScore: entry.overallScore,
              categoryScores: entry.categoryScores || {}
            });
          }
        });
      }

      // Also add current assessment score if not already in history
      const collectedAt = content.meta?.collectedAt;
      const overallScore = content.scores?.overall;
      if (collectedAt && overallScore != null) {
        const exists = trends.clients[clientId].trends.some(t => t.date === collectedAt);
        if (!exists) {
          trends.clients[clientId].trends.push({
            date: collectedAt,
            overallScore: typeof overallScore === 'number' ? overallScore : parseFloat(String(overallScore).replace(',', '.')) || 0,
            categoryScores: content.scores?.categories || {}
          });
        }
      }

      // Sort by date
      trends.clients[clientId].trends.sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
      console.error(`[ad-secure-trends] Error processing ${file}:`, err.message);
    }
  });

  return trends;
}

function readTrends() {
  const trendsPath = getTrendsPath();
  if (fs.existsSync(trendsPath)) {
    return JSON.parse(fs.readFileSync(trendsPath, 'utf8'));
  }
  // Seed from existing client files
  const seeded = seedTrendsFromClients();
  try {
    fs.writeFileSync(trendsPath, JSON.stringify(seeded, null, 2), 'utf8');
    console.log('[ad-secure-trends] Seeded trends file from existing client data');
  } catch (err) {
    console.error('[ad-secure-trends] Error writing seeded trends:', err.message);
  }
  return seeded;
}

function writeTrends(data) {
  const trendsPath = getTrendsPath();
  fs.writeFileSync(trendsPath, JSON.stringify(data, null, 2), 'utf8');
}

export default function handler(req, res) {
  try {
    switch (req.method) {
      case 'GET': {
        const trends = readTrends();
        const { clientId } = req.query;

        if (clientId) {
          return res.status(200).json({
            client: trends.clients[clientId] || null,
            trends: trends.clients[clientId]?.trends || []
          });
        }

        return res.status(200).json(trends);
      }

      case 'POST': {
        const { clientId, clientName, domain, date, overallScore, categoryScores } = req.body;

        if (!clientId || !date) {
          return res.status(400).json({ error: 'clientId and date are required' });
        }

        const trends = readTrends();

        if (!trends.clients[clientId]) {
          trends.clients[clientId] = { name: clientName || clientId, domain: domain || '', trends: [] };
        }

        // Update name/domain if provided
        if (clientName) trends.clients[clientId].name = clientName;
        if (domain) trends.clients[clientId].domain = domain;

        // Check if entry for this date already exists
        const existingIndex = trends.clients[clientId].trends.findIndex(t => t.date === date);
        const newEntry = { date, overallScore, categoryScores: categoryScores || {} };

        if (existingIndex >= 0) {
          trends.clients[clientId].trends[existingIndex] = newEntry;
        } else {
          trends.clients[clientId].trends.push(newEntry);
        }

        // Sort by date
        trends.clients[clientId].trends.sort((a, b) => a.date.localeCompare(b.date));

        writeTrends(trends);

        return res.status(200).json({
          success: true,
          client: trends.clients[clientId],
          trends: trends.clients[clientId].trends
        });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[ad-secure-trends] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
