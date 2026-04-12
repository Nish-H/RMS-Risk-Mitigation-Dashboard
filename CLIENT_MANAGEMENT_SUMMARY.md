# Multi-Client Support Implementation for AD Secure Score Dashboard

## Overview
The AD Secure Score Dashboard has been enhanced to support multiple clients with the following features:

### Key Features Implemented
1. **Client Selection Dropdown** - Users can switch between different client dashboards
2. **Automatic Client Data Loading** - On initial load, the system attempts to load known client data
3. **Import Function Enhancement** - When importing new JSON files, the system:
   - Extracts client name from filename or metadata
   - Adds new clients to the client list
   - Updates existing clients with new data
   - Automatically selects the imported client for viewing
4. **Persistent Client Storage** - Client data is maintained in state and available for switching

## How It Works

### Client Data Structure
Each client is stored as:
```javascript
{
  id: 'unique-identifier',  // Lowercase, no special characters
  name: 'Display Name',     // Human-readable name
  data: {
    findings: [ /* Array of assessment findings */ ],
    history: [ /* Array of historical data points */ ]
  }
}
```

### Client Selection
- A dropdown menu appears in the navigation bar next to the tab buttons
- Shows all loaded clients
- When a client is selected, their data is loaded into the dashboard
- Selected client is indicated with a dot (•) next to their name

### Data Import Enhancement
When importing a JSON file via the "Import Data" tab:
1. System extracts client name from:
   - `data.meta.domain` (preferred)
   - Filename (sanitized)
   - Defaults to "Unknown Client"
2. Creates or updates client entry in the clients list
3. Automatically selects the imported/client
4. Loads the data into the dashboard for immediate viewing

### Automatic Loading
On initial mount, the system:
1. Attempts to load known client data from common file patterns
2. Currently configured for:
   - Astons Legal (`ad_secure_score_AstonsLegal_2026-03-20.json`)
   - Den Local (`den_local_combined_2026-03-23.json`)
3. In a production environment, this would be replaced with an API call to fetch client list

## Files Modified
- `components/ad-secure-score-dashboard-v2.jsx` - Main implementation

## How to Use

### 1. Switching Between Clients
1. Navigate to the "AD Secure Score" tab
2. Use the dropdown menu in the upper right (next to tab buttons)
3. Select the desired client
4. Dashboard updates to show that client's data

### 2. Adding New Client Data
1. Navigate to the "AD Secure Score" tab
2. Click the "Import Data" tab (↑ icon)
3. Click "Choose File" and select the client's JSON assessment file
4. The system will:
   - Process the file
   - Add/update the client in the client list
   - Automatically switch to show that client's data
   - Display a success message

### 3. Monthly Updates Process
For ongoing monthly assessments:
1. Generate new JSON assessment file for client
2. Use the Import Data function to upload the file
3. System automatically updates the client's data
4. Historical data is preserved if included in the JSON
5. Switch between clients to view different assessments

## File Naming Convention
For best results with automatic client detection:
- Use format: `ad_secure_score_[ClientName]_[YYYY-MM-DD].json`
- Examples:
  - `ad_secure_score_AstonsLegal_2026-03-20.json`
  - `ad_secure_score_ContosoLtd_2026-03-23.json`

The system extracts the client name from the filename, removing non-alphanumeric characters and converting to lowercase for the client ID.

## Data Requirements
Imported JSON files must contain:
```json
{
  "meta": {
    "collectedAt": "YYYY-MM-DD",
    "collectedAtFull": "Month DD, YYYY",
    "domain": "client.domain.com"  // Optional but preferred for client name
  },
  "findings": [
    // Array of assessment finding objects
  ],
  "history": [
    // Optional: Array of monthly historical data
    { "date": "YYYY-MM", "overallScore": 0-100, "categoryScores": { ... } }
  ]
}
```

## Notes
1. The current implementation uses simulated client loading for demonstration
2. In production, replace the `loadClientData` function with an actual API call
3. Client data is stored in browser state and will be lost on page refresh
4. For persistent storage across sessions, consider implementing localStorage or backend persistence
5. The import function works with any valid JSON assessment file regardless of naming

## Troubleshooting
- If client data doesn't load: Check browser console for errors
- If import fails: Verify JSON is valid and contains `findings` array
- If client doesn't appear in dropdown: Ensure data was loaded successfully
- For assistance: Contact NishenH

## Future Enhancements
1. Persistent storage using localStorage or IndexedDB
2. Backend API integration for client data storage
3. Client grouping and filtering capabilities
4. Export/import of entire client database
5. Client-specific settings and preferences