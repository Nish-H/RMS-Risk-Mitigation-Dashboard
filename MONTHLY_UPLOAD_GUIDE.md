# Monthly JSON Upload Guide for AD Secure Score Dashboard

## Overview
The AD Secure Score Dashboard supports monthly JSON uploads to update the current assessment data. Your recently uploaded file (`ADSecureScoreData\ad_secure_score_AstonsLegal_2026-03-20.json`) is compatible with the dashboard's findings import functionality.

## How It Works
When you upload a JSON file:
1. The dashboard imports the `findings` array to display current month's data
2. If the JSON includes a valid `history` array, it updates the historical trend
3. If `history` is null/missing/invalid, the existing historical data is preserved
4. The dashboard automatically computes scores from findings (ignoring pre-computed scores in JSON)

## Your Uploaded File Analysis
Your file `ad_secure_score_AstonsLegal_2026-03-20.json`:
- ✅ Contains valid `findings` array with all required fields
- ⚠️ Has `"history": null` (will preserve existing history, not update trend)
- ✅ All findings have required fields: checkId, category, label, severity, score, status, threshold, actualValue, description, recommendation
- ⚠️ Includes extra fields (`remediationCmd`, `collectedAt`) which are safely ignored

## Expected Results After Upload
- **Current Month Score**: Computed from your findings (will display correctly)
- **Historical Trend**: Will show existing data (SEED_HISTORY or previous uploads)
- **All Dashboard Tabs**: Will function correctly with your data
- **Import Status**: Will show success message with check count

## For Monthly Updates
To maintain accurate historical tracking, your monthly JSON should include both current findings and updated history.

### Option 1: Simple Monthly Upload (Current Approach)
Upload JSON with findings only (like your current file):
- Shows current month's assessment
- Preserves existing historical trend (good for getting started)
- **Limitation**: Historical trend won't update with new months' scores

### Option 2: Complete Monthly Upload (Recommended for Tracking)
Include both findings and history in your JSON:

```json
{
  "meta": {
    "collectedAt": "2026-03-20",
    "collectedAtFull": "March 20, 2026",
    "domain": "your.domain.com",
    // ... other meta fields as needed
  },
  "findings": [
    // ... your array of finding objects (same as current file)
  ],
  "history": [
    { "date": "2025-09", "overallScore": 38, "categoryScores": { "identity": 35, "password": 30, "gpo": 28, "dchealth": 55, "hygiene": 40, "monitoring": 22 } },
    { "date": "2025-10", "overallScore": 43, "categoryScores": { "identity": 40, "password": 35, "gpo": 32, "dchealth": 60, "hygiene": 45, "monitoring": 25 } },
    // ... all previous months
    { "date": "2026-03", "overallScore": 53, "categoryScores": { "identity": 10, "password": 55, "gpo": 71, "dchealth": 87, "hygiene": 50, "monitoring": 60 } }
  ]
}
```

### Creating the History Array
To create the history array for your monthly upload:
1. Start with the seed data from `data/sample-data.json` (contains Sep 2025-Feb 2026)
2. Add current month's computed overall score and category scores
3. Format as shown above

## Recommendations
1. **First Upload**: Use your current JSON format to get started
2. **Subsequent Uploads**: 
   - Export current dashboard state to get existing history
   - Add current month's score to create complete history array
   - Upload JSON with both findings and history
3. **Automation**: Consider creating a script that:
   - Runs your AD assessment
   - Generates findings in the required format
   - Loads existing history from dashboard (or sample data)
   - Computes and adds current month's scores
   - Outputs complete JSON for upload

## Troubleshooting
- If import fails: Verify JSON is valid and contains `findings` array
- If scores seem wrong: Check that findings have numeric `score` values (0-100)
- If trend doesn't update: Ensure your upload includes a valid `history` array
- For assistance: Contact NishenH

## File Location
Place your monthly JSON files in: `ADSecureScoreData/`
Use descriptive names like: `ad_secure_score_[Domain]_[YYYY-MM-DD].json`

The dashboard's import function works with any valid JSON file selected via the UI, regardless of filename or location.