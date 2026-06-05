import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clientId, findings, history, meta, scores } = req.body;
    const clientName = (req.body.clientName || '').toUpperCase();
    
    if (!findings || !Array.isArray(findings)) {
      return res.status(400).json({ error: 'Invalid data: missing findings array' });
    }
    
    // Generate filename from client name
    const date = new Date().toISOString().split('T')[0];
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `ad_secure_score_${safeName}_${date}.json`;
    
    const dataDir = path.join(process.cwd(), 'ADSecureScoreData');
    
    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, filename);
    
    // Create data object
    const data = {
      meta: meta || {
        collectedAt: date,
        collectedAtFull: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
        domain: clientName
      },
      scores: scores || null,
      findings: findings,
      history: history || null
    };
    
    // Write file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    return res.status(200).json({ 
      success: true, 
      filename: filename,
      clientId: clientId,
      clientName: clientName
    });
    
  } catch (error) {
    console.error('Error saving client data:', error);
    return res.status(500).json({ error: error.message });
  }
}