# Admin Tools - HTML Tools Integration

## Overview
The Admin Tools section has been integrated into the RMS Risk Mitigation Dashboard, providing engineers with easy access to HTML-based administrative tools through a user-friendly tree structure interface.

## Structure

```
RMS Dashboard
├── Dashboard Tab (Original Risk Mitigation Dashboard)
└── Admin-Tools Tab
    └── HTML Tools Sub-tab (Tree structure with categories)
        ├── Reconciliation Tools
        ├── Security & Assessment
        ├── Reporting & Auditing
        └── Management Tools
```

## File Locations

### Components
- **Main Landing Page**: `/pages/index.js`
- **Admin Tools Component**: `/components/AdminTools.js`
- **Dashboard Component**: `/components/DashboardComponent.js`

### HTML Tools
- **Source Folder**: `/Nishen RMS Admin Tools/`
- **Web-Accessible Location**: `/public/admin-tools/html-tools/`

### Configuration
- **Tools Configuration**: `/config/admin-tools-config.json` (optional, for dynamic loading)

## How to Add New HTML Tools

### Method 1: Quick Add (Recommended)

1. **Add your HTML file** to `/public/admin-tools/html-tools/`
   ```bash
   cp your-new-tool.html /mnt/r/public/admin-tools/html-tools/
   ```

2. **Update the AdminTools component** (`/components/AdminTools.js`)
   - Locate the `htmlTools` object (around line 11)
   - Add your tool to the appropriate category or create a new category:

   ```javascript
   'Your Category Name': {
     icon: 'folder',
     tools: [
       {
         name: 'Your Tool Name',
         filename: 'your-new-tool.html',
         description: 'Brief description of what the tool does'
       }
     ]
   }
   ```

3. **Save the file** and restart the development server

### Method 2: Add New Category

To add a completely new category of tools:

```javascript
'New Category Name': {
  icon: 'folder',
  tools: [
    {
      name: 'Tool 1',
      filename: 'tool1.html',
      description: 'Description of Tool 1'
    },
    {
      name: 'Tool 2',
      filename: 'tool2.html',
      description: 'Description of Tool 2'
    }
  ]
}
```

Don't forget to add the category to the `expandedCategories` state (around line 9):

```javascript
const [expandedCategories, setExpandedCategories] = useState({
  'reconciliation': true,
  'security': true,
  'reporting': true,
  'management': true,
  'new-category': true  // Add your new category here
});
```

## Features

### Current Features
✅ Tree structure with collapsible categories
✅ Tools organized by function
✅ Opens tools in new window/tab
✅ Visual feedback for selected tools
✅ Dark mode support
✅ Responsive design
✅ Hover tooltips with descriptions
✅ Future-proof design for additional admin tools
✅ **View tracking** - Automatic tracking of tool usage
✅ **Like system** - Engineers can like their favorite tools
✅ **Rating system** - 5-star rating with average display
✅ **Real-time metrics** - Views, likes, and ratings update instantly
✅ **Metrics in tree view** - Quick stats visible in sidebar

### Future Extensibility

The design supports adding:
- More sub-tabs under Admin-Tools (e.g., "PowerShell Scripts", "API Tools")
- Dynamic tool loading from API
- Tool favorites/bookmarks
- Search functionality
- Tool usage analytics
- Permission-based tool access

## Adding New Sub-Tabs

To add a new sub-tab under Admin-Tools:

1. Open `/components/AdminTools.js`
2. Add a new state value for the tab
3. Add a new button in the sub-tab navigation section
4. Create a render function for the new tab content
5. Add a conditional render in the content area

Example:
```javascript
// Add to state options
const [activeSubTab, setActiveSubTab] = useState('html-tools');

// Add button
<button
  className={`px-6 py-3 font-semibold rounded-t-lg transition-colors ${
    activeSubTab === 'your-new-tab'
      ? 'bg-blue-500 text-white border-b-2 border-blue-500'
      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  }`}
  onClick={() => setActiveSubTab('your-new-tab')}
>
  Your New Tab
</button>

// Add content
{activeSubTab === 'your-new-tab' && renderYourNewTab()}
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Using the Rating System

### How It Works

**Views**
- Automatically tracked when a tool is opened
- Displayed with an eye icon 👁️
- Shows total number of times the tool has been viewed

**Likes**
- Click the heart icon ❤️ to like/unlike a tool
- Liked tools show a filled red heart
- Total likes displayed next to the heart icon

**Ratings**
- Click the "Rate" button to open the rating modal
- Select 1-5 stars based on your experience
- Average rating and total number of ratings displayed
- Star icon ⭐ shows the average rating

### Metrics Data Storage
- All metrics stored in `/data/tool-metrics.json`
- Persists across server restarts
- API endpoint: `/api/tool-metrics`

## Access

Once running, access the dashboard at: `http://localhost:3000`

- Click the **Admin-Tools** tab at the top
- Navigate the tree structure to find tools
- Click on any tool to open it in a new window
- Like tools by clicking the heart icon
- Rate tools by clicking the "Rate" button
- View metrics in both the tree view and detailed panels

## Troubleshooting

### Tools not opening?
- Check that pop-ups are enabled for the site
- Verify HTML files are in `/public/admin-tools/html-tools/`
- Check browser console for errors

### Styling issues?
- Ensure Tailwind CSS is properly configured
- Check dark mode toggle in the Dashboard tab
- Verify lucide-react icons are installed: `npm install lucide-react`

### Tree not expanding?
- Check the `expandedCategories` state includes your category key
- Category key should be lowercase with hyphens (e.g., 'security-assessment')

## Notes

- All HTML tools open in new windows to prevent navigation issues
- Tools maintain their own state and don't interact with the dashboard
- The tree structure automatically counts tools in each category
- Tools are accessible to all engineers on the domain when the dashboard is hosted

## Contact

For issues or enhancements, contact: **NishenH**

---

*Last Updated: November 2025*
*Hosted on: RMS-WEB01*
