import React, { useState, useEffect, useRef } from 'react';
import { Folder, File, ChevronRight, ChevronDown, ExternalLink, Heart, Eye, Star, RefreshCw, Search, Code, FileText, Upload, Download, Activity, Users, BarChart3, TrendingUp, Clock, X, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';

const AdminTools = () => {
  const [activeSubTab, setActiveSubTab] = useState('html-tools');
  const [selectedTool, setSelectedTool] = useState(null);
  const [htmlTools, setHtmlTools] = useState({});
  const [htmlCount, setHtmlCount] = useState(0);
  const [ps1Count, setPs1Count] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [metrics, setMetrics] = useState({});
  const [metricsSummary, setMetricsSummary] = useState(null);
  const [likedTools, setLikedTools] = useState(new Set());
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [currentRatingTool, setCurrentRatingTool] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importError, setImportError] = useState(null);
  const [visitorId, setVisitorId] = useState('');
  const [trackerData, setTrackerData] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let vid = localStorage.getItem('rms_visitor_id');
    if (!vid) {
      vid = 'visitor_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('rms_visitor_id', vid);
    }
    setVisitorId(vid);
    fetchMetrics();
    fetchTools();
    fetchTrackerData();

    const interval = setInterval(() => {
      fetchTools();
      fetchTrackerData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchTools = async (search = '') => {
    setLoading(true);
    setSearching(!!search);
    try {
      const url = search ? `/api/admin-tools?search=${encodeURIComponent(search)}` : '/api/admin-tools';
      const response = await fetch(url);
      const data = await response.json();
      setHtmlTools(data.toolsByCategory || {});
      setHtmlCount(data.htmlCount || 0);
      setPs1Count(data.ps1Count || 0);
      setSearchResults(data.searchResults || null);

      const categories = {};
      Object.keys(data.toolsByCategory || {}).forEach(key => {
        categories[key.toLowerCase().replace(/\s+/g, '-')] = true;
      });
      setExpandedCategories(prev => ({ ...prev, ...categories }));
    } catch (error) {
      console.error('Error fetching tools:', error);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/tool-metrics');
      const data = await response.json();
      setMetrics(data.tools || {});
      setMetricsSummary(data.summary);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchTrackerData = async () => {
    try {
      const response = await fetch('/api/tracker');
      const data = await response.json();
      setTrackerData(data);
    } catch (error) {
      console.error('Error fetching tracker data:', error);
    }
  };

  const updateMetric = async (filename, action, rating = null) => {
    try {
      const response = await fetch('/api/tool-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, action, rating, visitorId }),
      });
      const data = await response.json();
      if (data.success) {
        setMetrics(prev => ({ ...prev, [filename]: data.metrics }));
        fetchMetrics();
      }
    } catch (error) {
      console.error('Error updating metric:', error);
    }
  };

  const handleLike = (filename, e) => {
    e.stopPropagation();
    const isLiked = likedTools.has(filename);
    if (isLiked) {
      setLikedTools(prev => { const s = new Set(prev); s.delete(filename); return s; });
      updateMetric(filename, 'unlike');
    } else {
      setLikedTools(prev => new Set(prev).add(filename));
      updateMetric(filename, 'like');
    }
  };

  const handleRate = (filename, rating) => {
    updateMetric(filename, 'rate', rating);
    setRatingModalOpen(false);
    setCurrentRatingTool(null);
  };

  const openRatingModal = (filename, name, e) => {
    e.stopPropagation();
    setCurrentRatingTool({ filename, name });
    setRatingModalOpen(true);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setActiveSubTab('search');
    fetchTools(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setActiveSubTab('html-tools');
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const openTool = (filename, name) => {
    updateMetric(filename, 'download');
    window.open(`/admin-tools/html-tools/${filename}`, '_blank');
    setSelectedTool(name);
  };

  const handleImportClick = () => {
    setImportModalOpen(true);
    setImportResults(null);
    setImportError(null);
  };

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setImportResults(null);
    setImportError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
      }

      const response = await fetch('/api/import-tool', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setImportResults(data.results);
        fetchTools();
        fetchMetrics();
      } else {
        setImportError(data.error || 'Import failed');
      }
    } catch (error) {
      setImportError(error.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderStatsBar = () => {
    const t = trackerData || {};
    const s = metricsSummary || {};

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Total Views</span>
            <Eye size={14} className="text-blue-500" />
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{(s.totalViews || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Unique Downloads</span>
            <Download size={14} className="text-green-500" />
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{(s.totalDownloads || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Total Likes</span>
            <Heart size={14} className="text-red-500" />
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{(s.totalLikes || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Unique Visitors</span>
            <Users size={14} className="text-purple-500" />
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{(t.totalUniqueVisitors || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Today</span>
            <Activity size={14} className="text-amber-500" />
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{(t.todayVisitors || 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Active Now</span>
            <Clock size={14} className="text-cyan-500" />
          </div>
          <p className="text-lg font-bold text-green-500">{(t.currentActive || 0)}</p>
        </div>
      </div>
    );
  };

  const renderHtmlToolsTree = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="animate-spin mr-2" size={24} />
          <span>Loading tools...</span>
        </div>
      );
    }

    const toolCategories = Object.keys(htmlTools);
    if (toolCategories.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>No tools found in the folder.</p>
          <p className="text-sm mt-2">Use the <strong>Import Tool</strong> button above to upload .html or .ps1 files.</p>
          <button onClick={handleImportClick} className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm">
            <Upload size={14} className="inline mr-1" /> Import Tool Now
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border rounded-lg p-4 bg-white dark:bg-gray-800 shadow">
          <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">
            HTML Tools Library
          </h3>
          <div className="space-y-2">
            {Object.entries(htmlTools).map(([category, data], idx) => {
              const categoryKey = category.toLowerCase().replace(/\s+/g, '-');
              const isExpanded = expandedCategories[categoryKey];

              return (
                <div key={idx} className="border-l-2 border-gray-300 dark:border-gray-600">
                  <div
                    className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                    onClick={() => toggleCategory(categoryKey)}
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <Folder size={16} className="text-blue-500" />
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{category}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({data.tools.length})</span>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 space-y-1 mt-1">
                      {data.tools.map((tool, toolIdx) => {
                        const toolMetrics = metrics[tool.filename] || { views: 0, likes: 0, averageRating: 0, uniqueDownloads: 0 };

                        return (
                          <div
                            key={toolIdx}
                            className={`flex items-center space-x-2 p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer rounded transition-colors ${selectedTool === tool.name ? 'bg-blue-100 dark:bg-gray-600' : ''}`}
                            onClick={() => openTool(tool.filename, tool.name)}
                            title={tool.description}
                          >
                            <File size={14} className="text-green-600 dark:text-green-400" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{tool.name}</span>

                            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                              <div className="flex items-center space-x-0.5" title="Views">
                                <Eye size={10} /><span>{toolMetrics.views}</span>
                              </div>
                              <div className="flex items-center space-x-0.5" title="Downloads">
                                <Download size={10} /><span>{toolMetrics.uniqueDownloads}</span>
                              </div>
                              <div className="flex items-center space-x-0.5" title="Likes">
                                <Heart size={10} /><span>{toolMetrics.likes}</span>
                              </div>
                            </div>

                            <ExternalLink size={12} className="text-gray-400" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 border rounded-lg p-6 bg-white dark:bg-gray-800 shadow">
          <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Available HTML Tools
          </h3>

          <div className="space-y-6">
            {Object.entries(htmlTools).map(([category, data], idx) => (
              <div key={idx}>
                <h4 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400 flex items-center">
                  <Folder size={18} className="mr-2" />
                  {category}
                </h4>
                <div className="grid gap-4 ml-6">
                  {data.tools.map((tool, toolIdx) => {
                    const toolMetrics = metrics[tool.filename] || { views: 0, likes: 0, averageRating: 0, ratings: [], uniqueDownloads: 0 };
                    const isLiked = likedTools.has(tool.filename);

                    return (
                      <div
                        key={toolIdx}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-gray-50 dark:bg-gray-700"
                        onClick={() => openTool(tool.filename, tool.name)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                              {tool.filename.endsWith('.ps1') ? (
                                <Code size={16} className="mr-2 text-purple-600" />
                              ) : (
                                <File size={16} className="mr-2 text-green-600 dark:text-green-400" />
                              )}
                              {tool.name}
                              {tool.filename.endsWith('.ps1') && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">PS1</span>
                              )}
                            </h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{tool.description}</p>

                            <div className="flex items-center space-x-4 mt-3 flex-wrap gap-y-2">
                              <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400" title="Views">
                                <Eye size={14} /><span className="text-xs">{toolMetrics.views}</span>
                              </div>

                              <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400" title="Unique Downloads">
                                <Download size={14} /><span className="text-xs">{toolMetrics.uniqueDownloads || 0}</span>
                              </div>

                              <div className="flex items-center space-x-1">
                                <button
                                  className={`flex items-center space-x-1 ${isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'} hover:text-red-500 transition-colors`}
                                  onClick={(e) => handleLike(tool.filename, e)}
                                  title={isLiked ? 'Unlike' : 'Like'}
                                >
                                  <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                                  <span className="text-xs">{toolMetrics.likes}</span>
                                </button>
                              </div>

                              <div className="flex items-center space-x-1 text-yellow-500">
                                <Star size={14} fill="currentColor" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {toolMetrics.averageRating > 0 ? toolMetrics.averageRating.toFixed(1) : 'N/A'}
                                  {toolMetrics.ratings && toolMetrics.ratings.length > 0 && (
                                    <span className="ml-1">({toolMetrics.ratings.length})</span>
                                  )}
                                </span>
                              </div>

                              <button
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                onClick={(e) => openRatingModal(tool.filename, tool.name, e)}
                              >
                                Rate
                              </button>
                            </div>
                          </div>

                          <button
                            className="ml-4 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm flex items-center space-x-1"
                            onClick={(e) => { e.stopPropagation(); openTool(tool.filename, tool.name); }}
                          >
                            <span>Open</span>
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Note:</strong> Tools will open in a new window/tab. Make sure pop-ups are enabled for this site.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderSearchResults = () => {
    if (searching) {
      return (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="animate-spin mr-2" size={24} />
          <span>Searching...</span>
        </div>
      );
    }

    if (!searchResults || searchResults.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Search size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No results found for "{searchQuery}"</p>
          <p className="text-sm mt-2">Try a different search term</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-600 dark:text-gray-400">
            Found <strong className="text-yellow-600 dark:text-yellow-400">{searchResults.length}</strong> result(s) for "{searchQuery}"
          </p>
          <button onClick={clearSearch} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Clear Search</button>
        </div>

        <div className="grid gap-4">
          {searchResults.map((result, idx) => (
            <div
              key={idx}
              className="p-4 border-2 border-yellow-300 dark:border-yellow-600 rounded-lg bg-yellow-50 dark:bg-gray-800 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openTool(result.filename, result.name)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {result.filename.endsWith('.ps1') ? (
                      <Code size={18} className="text-purple-600" />
                    ) : (
                      <FileText size={18} className="text-blue-600" />
                    )}
                    <h5 className="font-semibold text-gray-800 dark:text-gray-100">{result.name}</h5>
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">{result.category}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{result.description}</p>
                  {result.excerpt && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 p-2 rounded font-mono">{result.excerpt}</p>
                  )}
                </div>
                <button className="ml-4 px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded text-sm flex items-center space-x-1 font-semibold">
                  <span>Open</span>
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderToolsActivity = () => {
    const t = trackerData || {};
    const s = metricsSummary || {};
    const topTools = s.topTools || [];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500">Total Page Views</p>
            <p className="text-2xl font-bold text-blue-600">{(t.totalPageViews || 0).toLocaleString()}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Unique Visitors</p>
            <p className="text-2xl font-bold text-green-600">{(t.totalUniqueVisitors || 0).toLocaleString()}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Tool Downloads</p>
            <p className="text-2xl font-bold text-purple-600">{(s.totalDownloads || 0).toLocaleString()}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Active Now</p>
            <p className="text-2xl font-bold text-amber-600">{t.currentActive || 0}</p>
          </div>
        </div>

        {topTools.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Tools by Views</h3>
            <div className="space-y-3">
              {topTools.map((tool, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <span className="text-xs font-medium text-gray-500 w-8 text-right">{i + 1}.</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{tool.name}</span>
                  <span className="text-xs text-gray-500">{tool.views} views</span>
                  <span className="text-xs text-green-500">{tool.uniqueDownloads || 0} dl</span>
                  <span className="text-xs text-red-500">{tool.likes || 0} likes</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Daily Activity (Last 7 Days)</h3>
          <div className="space-y-2">
            {(t.weeklyData || []).map((day, i) => (
              <div key={i} className="flex items-center space-x-3">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10">{day.day}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 relative overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 flex items-center justify-end pr-2 transition-all" style={{ width: `${Math.min(100, (day.visits / 100) * 100)}%` }}>
                    <span className="text-xs font-bold text-white">{day.visits}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{day.users} users</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderImportModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
            <Upload size={20} className="mr-2 text-blue-500" />
            Import Tool
          </h3>
          <button onClick={() => { setImportModalOpen(false); setImportResults(null); }} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Upload .html or .ps1 files to the tools library. Max file size: 50MB per file.
        </p>

        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to select files or drag & drop</p>
          <p className="text-xs text-gray-500 mt-1">Allowed: .html, .ps1</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.ps1"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {importing && (
          <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600">
            <RefreshCw className="animate-spin" size={18} />
            <span>Uploading...</span>
          </div>
        )}

        {importError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2">
            <AlertCircle size={16} className="text-red-500 mt-0.5" />
            <span className="text-sm text-red-700 dark:text-red-400">{importError}</span>
          </div>
        )}

        {importResults && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Upload Results:</h4>
            {importResults.map((r, i) => (
              <div key={i} className={`p-3 rounded-lg flex items-start space-x-2 ${r.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                {r.success ? <CheckCircle size={16} className="text-green-500 mt-0.5" /> : <AlertCircle size={16} className="text-red-500 mt-0.5" />}
                <div className="text-sm">
                  <p className={r.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                    {r.success ? `Imported: ${r.filename}` : `Failed: ${r.filename}`}
                  </p>
                  {r.success && r.originalName !== r.filename && (
                    <p className="text-xs text-gray-500">(renamed from {r.originalName})</p>
                  )}
                  {r.error && <p className="text-xs text-red-500">{r.error}</p>}
                  {r.size && <p className="text-xs text-gray-500">{(r.size / 1024).toFixed(1)} KB</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
            onClick={() => { setImportModalOpen(false); setImportResults(null); }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Admin Tools</h2>
      </div>

      {renderStatsBar()}

      <div className="mb-6 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-gray-800 dark:to-gray-700 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white dark:bg-gray-900 px-4 py-2 rounded-lg shadow-sm border border-yellow-300 dark:border-yellow-700">
              <FileText size={20} className="text-blue-600" />
              <span className="font-bold text-gray-800 dark:text-gray-100">HTML Tools:</span>
              <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{htmlCount}</span>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-gray-900 px-4 py-2 rounded-lg shadow-sm border border-yellow-300 dark:border-yellow-700">
              <Code size={20} className="text-purple-600" />
              <span className="font-bold text-gray-800 dark:text-gray-100">PowerShell:</span>
              <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{ps1Count}</span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tools by name, description, or content..."
                  className="w-full px-4 py-2 pr-10 rounded-lg border-2 border-yellow-300 dark:border-yellow-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                <Search size={18} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-600" />
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-lg border-2 border-yellow-500 dark:border-yellow-600 shadow-sm transition-colors flex items-center space-x-1"
              >
                <Search size={16} /><span>Search</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mb-6 border-b border-gray-300 dark:border-gray-700">
        <div className="flex space-x-1">
          <button
            className={`px-6 py-3 font-semibold rounded-t-lg transition-colors ${activeSubTab === 'html-tools' ? 'bg-blue-500 text-white border-b-2 border-blue-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            onClick={() => setActiveSubTab('html-tools')}
          >
            HTML Tools
          </button>

          <button
            className={`px-6 py-3 font-semibold rounded-t-lg transition-colors ${activeSubTab === 'activity' ? 'bg-amber-500 text-white border-b-2 border-amber-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            onClick={() => setActiveSubTab('activity')}
          >
            <Activity size={14} className="inline mr-1" />Activity
          </button>

          <button
            onClick={handleImportClick}
            className="ml-auto px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 text-sm"
            title="Import new tools"
          >
            <Upload size={16} /><span>Import Tool</span>
          </button>

          <button
            onClick={() => { fetchTools(); fetchMetrics(); fetchTrackerData(); }}
            disabled={loading}
            className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center space-x-1"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div>
        {activeSubTab === 'html-tools' && renderHtmlToolsTree()}
        {activeSubTab === 'search' && renderSearchResults()}
        {activeSubTab === 'activity' && renderToolsActivity()}
      </div>

      {ratingModalOpen && currentRatingTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Rate: {currentRatingTool.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">How would you rate this tool?</p>
            <div className="flex justify-center space-x-2 mb-6">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} className="hover:scale-110 transition-transform" onClick={() => handleRate(currentRatingTool.filename, rating)} title={`${rating} star${rating > 1 ? 's' : ''}`}>
                  <Star size={32} className="text-yellow-500" fill="currentColor" />
                </button>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <button className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500" onClick={() => { setRatingModalOpen(false); setCurrentRatingTool(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {importModalOpen && renderImportModal()}
    </div>
  );
};

export default AdminTools;
