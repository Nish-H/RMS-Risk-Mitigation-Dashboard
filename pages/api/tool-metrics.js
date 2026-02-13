import fs from 'fs';
import path from 'path';

const metricsFilePath = path.join(process.cwd(), 'data', 'tool-metrics.json');

// Helper function to read metrics
const readMetrics = () => {
  try {
    const data = fs.readFileSync(metricsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading metrics:', error);
    return {};
  }
};

// Helper function to write metrics
const writeMetrics = (metrics) => {
  try {
    fs.writeFileSync(metricsFilePath, JSON.stringify(metrics, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing metrics:', error);
    return false;
  }
};

// Calculate average rating
const calculateAverage = (ratings) => {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return (sum / ratings.length).toFixed(1);
};

export default function handler(req, res) {
  const { method } = req;

  if (method === 'GET') {
    // Get all metrics
    const metrics = readMetrics();
    res.status(200).json(metrics);
  } else if (method === 'POST') {
    // Update metrics
    const { filename, action, rating } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const metrics = readMetrics();

    // Initialize if doesn't exist
    if (!metrics[filename]) {
      metrics[filename] = {
        views: 0,
        likes: 0,
        ratings: [],
        averageRating: 0
      };
    }

    // Handle different actions
    switch (action) {
      case 'view':
        metrics[filename].views += 1;
        break;
      case 'like':
        metrics[filename].likes += 1;
        break;
      case 'unlike':
        metrics[filename].likes = Math.max(0, metrics[filename].likes - 1);
        break;
      case 'rate':
        if (rating >= 1 && rating <= 5) {
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
