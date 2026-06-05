import fs from 'fs';
import path from 'path';
import { deriveClientNameFromDomain } from '../../clientNameUtils';

export default function handler(req, res) {
  try {
    const dataDir = path.join(process.cwd(), 'ADSecureScoreData');
    console.log('[ad-secure-clients] Loading from:', dataDir);
    
    // Check if directory exists
    if (!fs.existsSync(dataDir)) {
      console.log('[ad-secure-clients] Directory not found');
      return res.status(200).json({ clients: [], error: 'Data directory not found' });
    }
    
    // Get all JSON files
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    console.log('[ad-secure-clients] Found files:', files.length);
    files.forEach(f => console.log('[ad-secure-clients] -', f));
    
    const clientsMap = new Map();
    
    files.forEach(file => {
      try {
        const filePath = path.join(dataDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        console.log('[ad-secure-clients] Processing:', file, 'findings count:', data.findings?.length);
        
        if (data.findings && Array.isArray(data.findings)) {
          // Determine domain-based display name
          const domain = data.meta?.domain || '';
          const derivedFromDomain = deriveClientNameFromDomain(domain);
          let clientName = derivedFromDomain || data.meta?.domain;
          console.log('[ad-secure-clients] domain:', domain, 'derived:', derivedFromDomain, 'clientName:', clientName);
          
          if (!clientName) {
            // Fallback to filename-based extraction
            clientName = file.replace(/\.[^/.]+$/, ''); // Remove extension
            clientName = clientName.replace(/^ad_secure_score_/, '');
            clientName = clientName.replace(/_ad_secure_score_/g, ' ');
            clientName = clientName.replace(/Shiplakes_College_/i, 'Shiplakes College ');
            clientName = clientName.replace(/_/g, ' ');
            clientName = clientName.replace(/\s+/g, ' ').trim();
          }
          
          if (!clientName) {
            clientName = file.replace('.json', '');
          }
          
          clientName = clientName.toUpperCase();
          
          const clientId = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '');
          console.log('[ad-secure-clients] FINAL clientId:', clientId, 'clientName:', clientName);
          
          const collectedAt = data.meta?.collectedAt || '1970-01-01';
          
          // Only keep the latest file for each client (by collectedAt date)
          const existing = clientsMap.get(clientId);
          if (existing && existing.lastUpdated > collectedAt) {
            console.log('[ad-secure-clients] SKIP - existing date newer:', existing.lastUpdated, '>', collectedAt);
            return;
          }
          
          console.log('[ad-secure-clients] ADD/UPDATE client:', clientName, collectedAt);
          
          clientsMap.set(clientId, {
            id: clientId,
            name: clientName,
            filename: file,
            data: {
              findings: data.findings,
              history: data.history || null,
              meta: data.meta || null,
              scores: data.scores || null
            },
            lastUpdated: collectedAt
          });
        }
      } catch (err) {
        console.error(`Error processing file ${file}:`, err.message);
      }
    });
    
    // Convert map to array and sort by name
    const clients = Array.from(clientsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    console.log('[ad-secure-clients] Final clients:', clients.length);
    clients.forEach(c => console.log('[ad-secure-clients] - ', c.name, 'score:', c.data?.scores?.overall, 'date:', c.lastUpdated));
    
    return res.status(200).json({ clients });
    
  } catch (error) {
    console.error('Error loading clients:', error);
    return res.status(500).json({ clients: [], error: error.message });
  }
}
