# AD Secure Score Dashboard - Data Import Instructions

## Monthly JSON Data Upload

The AD Secure Score Dashboard supports importing monthly assessment data via JSON files. Follow these steps to upload your monthly data:

### 1. Prepare Your JSON File
Your JSON file should follow this structure:

```json
{
  "meta": {
    "collectedAt": "YYYY-MM-DD",
    "collectedAtFull": "Month DD, YYYY"
  },
  "findings": [
    {
      "checkId": "check-identifier",
      "category": "identity|password|gpo|dchealth|hygiene|monitoring",
      "label": "Human-readable check name",
      "severity": "Critical|High|Medium|Low",
      "score": 0-100,
      "status": "Pass|Warning|Fail",
      "threshold": "Expected value description",
      "actualValue": "Actual measured value",
      "description": "Detailed description of the check",
      "recommendation": "Recommended remediation steps"
    }
    // ... more findings
  ],
  "history": [
    {
      "date": "YYYY-MM",
      "overallScore": 0-100,
      "categoryScores": {
        "identity": 0-100,
        "password": 0-100,
        "gpo": 0-100,
        "dchealth": 0-100,
        "hygiene": 0-100,
        "monitoring": 0-100
      }
    }
    // ... historical data points
  ]
}
```

### 2. Upload Your Data
1. Navigate to the "AD Secure Score" tab in the dashboard
2. Click on the "Import Data" tab (↑ icon)
3. Click the "Choose File" button and select your JSON file
4. Click "Open" to upload the file
5. The dashboard will automatically load your data and switch to the Overview tab

### 3. Sample Data
A sample data file has been provided at `data/sample-data.json` to demonstrate the expected format.

### 4. Monthly Update Process
1. Generate your monthly AD security assessment data in the specified JSON format
2. Replace the contents of `data/monthly-data.json` with your new data (or upload via the UI)
3. The dashboard will automatically use the most recently uploaded data

### 5. Troubleshooting
- If you see "Invalid JSON: missing findings array", your file doesn't match the expected structure
- If you see "JSON parse error", check that your file is valid JSON
- Ensure all required fields are present in each finding object
- Scores should be numbers between 0-100
- Valid categories: identity, password, gpo, dchealth, hygiene, monitoring
- Valid severities: Critical, High, Medium, Low
- Valid statuses: Pass, Warning, Fail

For assistance, contact NishenH.