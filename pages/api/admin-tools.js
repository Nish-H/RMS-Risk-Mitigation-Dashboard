import fs from 'fs';
import path from 'path';

const htmlToolsDir = path.join(process.cwd(), 'public', 'admin-tools', 'html-tools');

const categorizeTool = (filename) => {
  const name = filename.toLowerCase();
  
  if (name.includes('reconciliation') || name.includes('realignment')) {
    return 'Reconciliation Tools';
  }
  if (name.includes('security') || name.includes('risk') || name.includes('assessment') || name.includes('password') || name.includes('ad ') || name.includes('active directory')) {
    return 'Security & Assessment';
  }
  if (name.includes('report') || name.includes('audit') || name.includes('incident')) {
    return 'Reporting & Auditing';
  }
  if (name.includes('script') || name.includes('manager') || name.includes('dashboard') || name.includes('homepage')) {
    return 'Management Tools';
  }
  if (name.includes('recorder') || name.includes('sop') || name.includes('tool') || name.includes('template')) {
    return 'Productivity Tools';
  }
  return 'Other Tools';
};

const getToolDescription = (filename) => {
  const name = filename.replace(/\.html$/i, '').replace(/_/g, ' ').replace(/-/g, ' ');
  return name;
};

const getFileContent = (filename) => {
  try {
    const filePath = path.join(htmlToolsDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    return content.substring(0, 5000);
  } catch (error) {
    return '';
  }
};

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { search } = req.query;

  try {
    if (!fs.existsSync(htmlToolsDir)) {
      return res.status(200).json({ toolsByCategory: {}, htmlCount: 0, ps1Count: 0 });
    }

    const files = fs.readdirSync(htmlToolsDir);
    const htmlFiles = files.filter(file => 
      file.endsWith('.html') || file.endsWith('.ps1')
    );

    const htmlCount = htmlFiles.filter(f => f.endsWith('.html')).length;
    const ps1Count = htmlFiles.filter(f => f.endsWith('.ps1')).length;

    const toolsByCategory = {};
    const searchResults = [];

    htmlFiles.forEach(filename => {
      const category = categorizeTool(filename);
      const toolName = filename.replace(/\.html$/i, '').replace(/_/g, ' ').replace(/-/g, ' ');
      const description = getToolDescription(filename);
      const content = getFileContent(filename);
      
      if (!toolsByCategory[category]) {
        toolsByCategory[category] = {
          icon: 'folder',
          tools: []
        };
      }

      const tool = {
        name: toolName,
        filename: filename,
        description: description,
        category: category,
        content: content
      };

      toolsByCategory[category].tools.push(tool);

      if (search) {
        const searchLower = search.toLowerCase();
        const matchesName = toolName.toLowerCase().includes(searchLower);
        const matchesDesc = description.toLowerCase().includes(searchLower);
        const matchesContent = content.toLowerCase().includes(searchLower);

        if (matchesName || matchesDesc || matchesContent) {
          const excerpt = matchesContent ? getExcerpt(content, search) : '';
          searchResults.push({
            ...tool,
            matchType: matchesName ? 'name' : matchesDesc ? 'description' : 'content',
            excerpt
          });
        }
      }
    });

    res.status(200).json({ 
      toolsByCategory, 
      htmlCount, 
      ps1Count,
      searchResults: searchResults.length > 0 ? searchResults : null
    });
  } catch (error) {
    console.error('Error reading tools directory:', error);
    res.status(500).json({ error: 'Failed to read tools directory' });
  }
}

function getExcerpt(content, searchTerm) {
  const searchLower = searchTerm.toLowerCase();
  const contentLower = content.toLowerCase();
  const index = contentLower.indexOf(searchLower);
  
  if (index === -1) return '';
  
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + searchTerm.length + 100);
  
  return (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
}
