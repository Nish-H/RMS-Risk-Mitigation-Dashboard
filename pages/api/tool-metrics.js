import fs from 'fs';
import path from 'path';

const metricsFilePath = path.join(process.cwd(), 'data', 'tool-metrics.json');

const readMetrics = () => {
  try {
    const data = fs.readFileSync(metricsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading metrics:', error);
    return {};
  }
};

const writeMetrics = (metrics) => {
  try {
    fs.writeFileSync(metricsFilePath, JSON.stringify(metrics, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing metrics:', error);
    return false;
  }
};

const calculateAverage = (ratings) => {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return parseFloat((sum / ratings.length).toFixed(1));
};

const getDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function handler(req, res) {
  const { method } = req;

  if (method === 'GET') {
    const metrics = readMetrics();
    const enhanced = {};

    Object.entries(metrics).forEach(([filename, data]) => {
      enhanced[filename] = {
        ...data,
        uniqueDownloads: data.uniqueDownloads || 0,
        downloadVisitors: data.downloadVisitors || [],
        viewHistory: data.viewHistory || [],
        averageRating: data.averageRating || 0,
        ratings: data.ratings || [],
        likes: data.likes || 0,
        views: data.views || 0
      };
    });

    const totalViews = Object.values(enhanced).reduce((sum, m) => sum + (m.views || 0), 0);
    const totalDownloads = Object.values(enhanced).reduce((sum, m) => sum + (m.uniqueDownloads || 0), 0);
    const totalLikes = Object.values(enhanced).reduce((sum, m) => sum + (m.likes || 0), 0);
    const totalRatings = Object.values(enhanced).reduce((sum, m) => sum + (m.ratings?.length || 0), 0);
    const totalTools = Object.keys(enhanced).length;
    const topTools = Object.entries(enhanced)
      .sort((a, b) => (b[1].views || 0) - (a[1].views || 0))
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));

    res.status(200).json({
      tools: enhanced,
      summary: {
        totalViews,
        totalDownloads,
        totalLikes,
        totalRatings,
        totalTools,
        topTools
      }
    });
  } else if (method === 'POST') {
    const { filename, action, rating, visitorId } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const metrics = readMetrics();

    if (!metrics[filename]) {
      metrics[filename] = {
        views: 0,
        likes: 0,
        ratings: [],
        averageRating: 0,
        uniqueDownloads: 0,
        downloadVisitors: [],
        viewHistory: []
      };
    }

    const today = getDateKey();

    switch (action) {
      case 'view':
        metrics[filename].views += 1;
        metrics[filename].viewHistory.push({ date: today, timestamp: new Date().toISOString(), visitorId: visitorId || 'anonymous' });
        if (metrics[filename].viewHistory.length > 1000) {
          metrics[filename].viewHistory = metrics[filename].viewHistory.slice(-500);
        }
        break;

      case 'download':
      case 'open':
        metrics[filename].views += 1;
        metrics[filename].viewHistory.push({ date: today, timestamp: new Date().toISOString(), visitorId: visitorId || 'anonymous' });
        if (metrics[filename].viewHistory.length > 1000) {
          metrics[filename].viewHistory = metrics[filename].viewHistory.slice(-500);
        }
        if (visitorId && (!metrics[filename].downloadVisitors || !metrics[filename].downloadVisitors.includes(visitorId))) {
          metrics[filename].uniqueDownloads = (metrics[filename].uniqueDownloads || 0) + 1;
          if (!metrics[filename].downloadVisitors) metrics[filename].downloadVisitors = [];
          metrics[filename].downloadVisitors.push(visitorId);
        }
        break;

      case 'like':
        metrics[filename].likes = (metrics[filename].likes || 0) + 1;
        break;

      case 'unlike':
        metrics[filename].likes = Math.max(0, (metrics[filename].likes || 0) - 1);
        break;

      case 'rate':
        if (rating >= 1 && rating <= 5) {
          if (!metrics[filename].ratings) metrics[filename].ratings = [];
          metrics[filename].ratings.push(rating);
          metrics[filename].averageRating = calculateAverage(metrics[filename].ratings);
        } else {
          return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const success = writeMetrics(metrics);

    if (success) {
      res.status(200).json({
        success: true,
        metrics: metrics[filename]
      });
    } else {
      res.status(500).json({ error: 'Failed to update metrics' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
