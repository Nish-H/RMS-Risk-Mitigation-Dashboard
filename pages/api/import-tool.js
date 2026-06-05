import fs from 'fs';
import path from 'path';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

const htmlToolsDir = path.join(process.cwd(), 'public', 'admin-tools', 'html-tools');

const ALLOWED_EXTENSIONS = ['.html', '.ps1'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!fs.existsSync(htmlToolsDir)) {
      fs.mkdirSync(htmlToolsDir, { recursive: true });
    }

    const form = formidable({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024,
      filter: (part) => {
        const name = part.originalFilename || part.filename || '';
        const ext = path.extname(name).toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      }
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploadedFiles = files.file || files.files || [];
    const fileArray = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

    if (fileArray.length === 0) {
      return res.status(400).json({ error: 'No files uploaded. Allowed: .html, .ps1' });
    }

    const results = [];

    for (const file of fileArray) {
      if (!file || !file.filepath) continue;

      const ext = path.extname(file.originalFilename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        results.push({
          filename: file.originalFilename,
          success: false,
          error: `File type ${ext} not allowed`
        });
        continue;
      }

      const destPath = path.join(htmlToolsDir, file.originalFilename);

      let finalPath = destPath;
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        const nameWithoutExt = path.basename(file.originalFilename, ext);
        finalPath = path.join(htmlToolsDir, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
      }

      try {
        fs.copyFileSync(file.filepath, finalPath);
        results.push({
          filename: path.basename(finalPath),
          originalName: file.originalFilename,
          success: true,
          size: file.size
        });
      } catch (copyErr) {
        results.push({
          filename: file.originalFilename,
          success: false,
          error: copyErr.message
        });
      }
    }

    res.status(200).json({
      success: results.some(r => r.success),
      results
    });

  } catch (error) {
    console.error('Error importing tool:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
}
