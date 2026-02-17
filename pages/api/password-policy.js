import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    if (!fs.existsSync(dataDir)) {
      return res.status(200).json({
        MaxPasswordAgeDays: 90,
        MinPasswordAgeDays: 1,
        MinPasswordLength: 8,
        PasswordHistoryCount: 24,
        LockoutThreshold: 0,
        LockoutDurationMinutes: 30,
        ComplexityEnabled: true,
        ReversibleEncryptionEnabled: false,
        note: 'No policy data found - using defaults'
      });
    }

    const files = fs.readdirSync(dataDir);
    const policyFiles = files.filter(f => f.endsWith('_PasswordPolicy.json'));

    if (policyFiles.length === 0) {
      return res.status(200).json({
        MaxPasswordAgeDays: 90,
        MinPasswordAgeDays: 1,
        MinPasswordLength: 8,
        PasswordHistoryCount: 24,
        LockoutThreshold: 0,
        LockoutDurationMinutes: 30,
        ComplexityEnabled: true,
        ReversibleEncryptionEnabled: false,
        note: 'No policy file found - using defaults'
      });
    }

    // Get the most recent policy file
    const latestFile = policyFiles.sort().pop();
    const policyPath = path.join(dataDir, latestFile);
    const policyData = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

    res.status(200).json(policyData);
  } catch (error) {
    console.error('Error reading password policy:', error);
    res.status(200).json({
      MaxPasswordAgeDays: 90,
      MinPasswordAgeDays: 1,
      MinPasswordLength: 8,
      PasswordHistoryCount: 24,
      LockoutThreshold: 0,
      LockoutDurationMinutes: 30,
      ComplexityEnabled: true,
      ReversibleEncryptionEnabled: false,
      note: 'Error reading policy - using defaults'
    });
  }
}
