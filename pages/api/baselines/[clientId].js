import fs from 'fs';
import path from 'path';
function fp(c) { return path.join(process.cwd(), 'data', 'baseline_' + c.replace(/[^a-z0-9-_]/gi, '') + '.json'); }
export default function handler(req, res) {
  const { clientId } = req.query;
  if (req.method === 'GET') {
    if (clientId === '_list') {
      const dir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dir)) return res.status(200).json({ clients: [] });
      const clients = fs.readdirSync(dir).filter(f => f.startsWith('baseline_') && f.endsWith('.json')).map(f => {
        try { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return { clientId: f.replace('baseline_','').replace('.json',''), clientName: d.clientName||d.clientId, lastUpdated: d.lastUpdated||null, licenseTier: d.licenseTier||'standard', overallCompliance: d.overallCompliance||0 }; } catch { return null; }
      }).filter(Boolean).sort((a,b)=>(a.clientName||'').localeCompare(b.clientName||''));
      return res.status(200).json({ clients });
    }
    const f = fp(clientId);
    if (!fs.existsSync(f)) return res.status(200).json({ clientId, clientName: clientId, items: {}, overallCompliance: 0 });
    return res.status(200).json(JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  if (req.method === 'PUT' && req.body) {
    req.body.lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(fp(req.body.clientId), JSON.stringify(req.body, null, 2), 'utf8');
    return res.status(200).json({ success: true });
  }
  if (req.method === 'DELETE') { const f = fp(clientId); if (fs.existsSync(f)) { fs.unlinkSync(f); return res.status(200).json({ success: true }); } return res.status(404).json({ error: 'Not found' }); }
  res.status(405).json({ error: 'Method not allowed' });
}
