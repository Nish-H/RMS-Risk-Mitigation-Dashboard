import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clientId, findings, adminPassword, originalFindings } = req.body;
    
    // Verify admin password
    const CORRECT_PASSWORD = "AdS3cuR3Rm$542NH01";
    if (adminPassword !== CORRECT_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    if (!clientId || !findings) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Log the changes made
    const logDir = path.join(process.cwd(), 'ADSecureScoreData', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `changes_${new Date().toISOString().split('T')[0]}.log`);
    const timestamp = new Date().toISOString();
    const clientName = clientId;
    
    // Find changes
    const changes = [];
    if (originalFindings && Array.isArray(originalFindings)) {
      findings.forEach((finding, index) => {
        const original = originalFindings[index];
        if (original && original.score !== finding.score) {
          changes.push({
            checkId: finding.checkId,
            label: finding.label,
            oldScore: original.score,
            newScore: finding.score,
            oldStatus: original.status,
            newStatus: finding.status
          });
        }
      });
    }
    
    // Write log entry
    const logEntry = `\n=== ${timestamp} ===\nClient: ${clientName}\nAdmin: Nishen Harichunder\nChanges:\n${changes.map(c => `  - ${c.label}: ${c.oldScore} -> ${c.newScore} (${c.oldStatus} -> ${c.newStatus})`).join('\n')}\n`;
    
    fs.appendFileSync(logFile, logEntry);
    
    // Update the client's data file
    const dataDir = path.join(process.cwd(), 'ADSecureScoreData');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !f.startsWith('changes'));
    
    // Try to find matching file by client ID
    let clientFile = files.find(f => {
      const fileId = f.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const searchId = clientId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return fileId.includes(searchId) || searchId.includes(fileId);
    });
    
    // If no match, try by domain in metadata
    if (!clientFile) {
      for (const f of files) {
        try {
          const filePath = path.join(dataDir, f);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const domain = content.meta?.domain?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || '';
          const searchId = clientId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (domain.includes(searchId) || searchId.includes(domain)) {
            clientFile = f;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (clientFile) {
      const filePath = path.join(dataDir, clientFile);
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Update findings
      fileContent.findings = findings;
      
      // Update meta
      fileContent.meta = fileContent.meta || {};
      fileContent.meta.lastModified = timestamp;
      fileContent.meta.modifiedBy = 'Nishen Harichunder';
      fileContent.meta.lastScore = findings.reduce((sum, f) => sum + f.score, 0) / findings.length;
      
      fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
    } else {
      // Create new file if no matching file found
      const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
      const newFileName = `ad_secure_score_${safeName}_${new Date().toISOString().split('T')[0]}.json`;
      const newFilePath = path.join(dataDir, newFileName);
      
      const newContent = {
        meta: {
          collectedAt: new Date().toISOString().split('T')[0],
          domain: clientName,
          lastModified: timestamp,
          modifiedBy: 'Nishen Harichunder'
        },
        findings: findings,
        history: null
      };
      
      fs.writeFileSync(newFilePath, JSON.stringify(newContent, null, 2));
      clientFile = newFileName;
    }
    
    return res.status(200).json({ 
      success: true, 
      message: `Saved ${changes.length} changes for ${clientName}`,
      changesCount: changes.length,
      savedToFile: clientFile
    });
    
  } catch (error) {
    console.error('Error saving findings:', error);
    return res.status(500).json({ error: error.message });
  }
}