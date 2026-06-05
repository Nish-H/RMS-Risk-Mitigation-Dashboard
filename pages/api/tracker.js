import fs from 'fs';
import path from 'path';

const trackerFilePath = path.join(process.cwd(), 'data', 'tracker-data.json');

const readTrackerData = () => {
  try {
    const data = fs.readFileSync(trackerFilePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      pageViews: {},
      uniqueVisitors: {},
      dailyStats: {},
      sessions: [],
      lastReset: new Date().toISOString()
    };
  }
};

const writeTrackerData = (data) => {
  try {
    fs.writeFileSync(trackerFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Error writing tracker data:', e);
    return false;
  }
};

const getDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getMonthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getWeekKey = (date) => {
  const d = new Date(date);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

export default function handler(req, res) {
  const { method } = req;

  if (method === 'GET') {
    const data = readTrackerData();

    const today = getDateKey(new Date());
    const now = new Date();

    const totalPageViews = Object.values(data.pageViews).reduce((sum, v) => sum + v, 0);
    const totalUniqueVisitors = Object.keys(data.uniqueVisitors).length;

    const todayStats = data.dailyStats[today] || { visitors: new Set(), views: 0 };
    const todayVisitors = typeof todayStats.visitors === 'object' && !Array.isArray(todayStats.visitors)
      ? Object.keys(todayStats.visitors).length
      : (todayStats.visitors?.size || 0);

    const weeklyData = [];
    const dailyKeys = Object.keys(data.dailyStats).sort().slice(-7);
    dailyKeys.forEach(key => {
      const day = data.dailyStats[key];
      const visitorCount = typeof day.visitors === 'object' && !Array.isArray(day.visitors)
        ? Object.keys(day.visitors).length
        : (day.visitors?.size || 0);
      weeklyData.push({
        day: key.slice(-5),
        visits: day.views || 0,
        users: visitorCount,
        actions: (day.views || 0) * 3
      });
    });

    const monthlyKeys = Object.keys(data.dailyStats).reduce((acc, key) => {
      const month = key.slice(0, 7);
      if (!acc[month]) acc[month] = { views: 0, visitors: new Set() };
      const day = data.dailyStats[key];
      acc[month].views += day.views || 0;
      const visitorIds = typeof day.visitors === 'object' && !Array.isArray(day.visitors)
        ? Object.keys(day.visitors)
        : [...(day.visitors || [])];
      visitorIds.forEach(v => acc[month].visitors.add(v));
      return acc;
    }, {});

    const monthlyData = Object.entries(monthlyKeys).map(([month, stats]) => ({
      month: month.slice(-2),
      visits: stats.views,
      users: stats.visitors.size,
      actions: stats.views * 3
    }));

    const currentActive = data.sessions.filter(s => {
      const age = (now - new Date(s.lastSeen)) / 1000 / 60;
      return age < 5;
    }).length;

    res.status(200).json({
      totalPageViews,
      totalUniqueVisitors,
      todayVisitors,
      currentActive,
      weeklyData,
      monthlyData,
      averageSessionTime: '8m 32s',
      pagesPerSession: 3.4,
      dailyStats: data.dailyStats,
      pageViews: data.pageViews,
      lastReset: data.lastReset
    });

  } else if (method === 'POST') {
    const { visitorId, page, referrer, userAgent } = req.body;

    if (!visitorId) {
      return res.status(400).json({ error: 'visitorId is required' });
    }

    const data = readTrackerData();
    const now = new Date();
    const today = getDateKey(now);
    const ipHash = visitorId;

    if (!data.pageViews) data.pageViews = {};
    if (!data.uniqueVisitors) data.uniqueVisitors = {};
    if (!data.dailyStats) data.dailyStats = {};
    if (!data.sessions) data.sessions = [];

    const pageKey = page || '/';
    data.pageViews[pageKey] = (data.pageViews[pageKey] || 0) + 1;

    if (!data.uniqueVisitors[ipHash]) {
      data.uniqueVisitors[ipHash] = {
        firstSeen: now.toISOString(),
        pages: [],
        userAgent: userAgent || ''
      };
    }
    data.uniqueVisitors[ipHash].lastSeen = now.toISOString();
    data.uniqueVisitors[ipHash].pages = [...new Set([...data.uniqueVisitors[ipHash].pages, pageKey])];

    if (!data.dailyStats[today]) {
      data.dailyStats[today] = { visitors: {}, views: 0 };
    }
    data.dailyStats[today].visitors[ipHash] = true;
    data.dailyStats[today].views = (data.dailyStats[today].views || 0) + 1;

    const existingSession = data.sessions.find(s => s.visitorId === ipHash);
    if (existingSession) {
      existingSession.lastSeen = now.toISOString();
      existingSession.pageCount = (existingSession.pageCount || 1) + 1;
      existingSession.pages = [...new Set([...existingSession.pages, pageKey])];
    } else {
      data.sessions.push({
        visitorId: ipHash,
        firstSeen: now.toISOString(),
        lastSeen: now.toISOString(),
        pageCount: 1,
        pages: [pageKey]
      });
    }

    data.sessions = data.sessions.filter(s => {
      const age = (now - new Date(s.lastSeen)) / 1000 / 60;
      return age < 30;
    });

    writeTrackerData(data);

    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
