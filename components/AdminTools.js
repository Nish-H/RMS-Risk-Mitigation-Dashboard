import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown, ExternalLink, Heart, Eye, Star, RefreshCw, Search, Code, FileText } from 'lucide-react';

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
  const [expandedCategories, setExpandedCategories] = useState({
    'reconciliation-tools': true,
    'security-&-assessment': true,
    'reporting-&-auditing': true,
    'management-tools': true,
    'productivity-tools': true,
    'other-tools': true
  });
  const [metrics, setMetrics] = useState({});
  const [likedTools, setLikedTools] = useState(new Set());
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [currentRatingTool, setCurrentRatingTool] = useState(null);

  // Fetch metrics and tools on component mount
  useEffect(() => {
    fetchMetrics();
    fetchTools();

    // Auto-refresh tools every 30 seconds to detect new files
    const interval = setInterval(() => {
      fetchTools();
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
      
      // Initialize expanded categories based on fetched data
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
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const updateMetric = async (filename, action, rating = null) => {
    try {
      const response = await fetch('/api/tool-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, action, rating }),
      });
      const data = await response.json();

      if (data.success) {
        // Update local metrics state
        setMetrics(prev => ({
          ...prev,
          [filename]: data.metrics
        }));
      }
    } catch (error) {
      console.error('Error updating metric:', error);
    }
  };

  const handleLike = (filename, e) => {
    e.stopPropagation();
    const isLiked = likedTools.has(filename);

    if (isLiked) {
      setLikedTools(prev => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
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
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const openTool = (filename, name) => {
    // Track view
    updateMetric(filename, 'view');
    // Open tool in new window/tab
    window.open(`/admin-tools/html-tools/${filename}`, '_blank');
    setSelectedTool(name);
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
          <p>No tools found in the folder.</p>
          <p className="text-sm mt-2">Copy .html or .ps1 files to public/admin-tools/html-tools/</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tree Structure Panel */}
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
                  {/* Category Header */}
                  <div
                    className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                    onClick={() => toggleCategory(categoryKey)}
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <Folder size={16} className="text-blue-500" />
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {category}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({data.tools.length})
                    </span>
                  </div>

                  {/* Tools List */}
                  {isExpanded && (
                    <div className="ml-6 space-y-1 mt-1">
                      {data.tools.map((tool, toolIdx) => {
                        const toolMetrics = metrics[tool.filename] || { views: 0, likes: 0, averageRating: 0 };

                        return (
                          <div
                            key={toolIdx}
                            className={`flex items-center space-x-2 p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer rounded transition-colors ${
                              selectedTool === tool.name ? 'bg-blue-100 dark:bg-gray-600' : ''
                            }`}
                            onClick={() => openTool(tool.filename, tool.name)}
                            title={tool.description}
                          >
                            <File size={14} className="text-green-600 dark:text-green-400" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                              {tool.name}
                            </span>

                            {/* Quick Metrics */}
                            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                              <div className="flex items-center space-x-0.5" title="Views">
                                <Eye size={10} />
                                <span>{toolMetrics.views}</span>
                              </div>
                              <div className="flex items-center space-x-0.5" title="Likes">
                                <Heart size={10} />
                                <span>{toolMetrics.likes}</span>
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

        {/* Tools Info Panel */}
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
                    const toolMetrics = metrics[tool.filename] || { views: 0, likes: 0, averageRating: 0, ratings: [] };
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
                              <File size={16} className="mr-2 text-green-600 dark:text-green-400" />
                              {tool.name}
                            </h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {tool.description}
                            </p>

                            {/* Metrics Display */}
                            <div className="flex items-center space-x-4 mt-3">
                              {/* Views */}
                              <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                                <Eye size={14} />
                                <span className="text-xs">{toolMetrics.views}</span>
                              </div>

                              {/* Likes */}
                              <div className="flex items-center space-x-1">
                                <button
                                  className={`flex items-center space-x-1 ${
                                    isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'
                                  } hover:text-red-500 transition-colors`}
                                  onClick={(e) => handleLike(tool.filename, e)}
                                  title={isLiked ? 'Unlike' : 'Like'}
                                >
                                  <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                                  <span className="text-xs">{toolMetrics.likes}</span>
                                </button>
                              </div>

                              {/* Rating */}
                              <div className="flex items-center space-x-1 text-yellow-500">
                                <Star size={14} fill="currentColor" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {toolMetrics.averageRating > 0 ? toolMetrics.averageRating : 'N/A'}
                                  {toolMetrics.ratings && toolMetrics.ratings.length > 0 && (
                                    <span className="ml-1">({toolMetrics.ratings.length})</span>
                                  )}
                                </span>
                              </div>

                              {/* Rate Button */}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              openTool(tool.filename, tool.name);
                            }}
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
          <button
            onClick={clearSearch}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear Search
          </button>
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
                    <h5 className="font-semibold text-gray-800 dark:text-gray-100">
                      {result.name}
                    </h5>
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                      {result.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {result.description}
                  </p>
                  {result.excerpt && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 p-2 rounded font-mono">
                      {result.excerpt}
                    </p>
                  )}
                </div>
                <button
                  className="ml-4 px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded text-sm flex items-center space-x-1 font-semibold"
                >
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

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        Admin Tools
      </h2>

      {/* Stats and Search Bar */}
      <div className="mb-6 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-gray-800 dark:to-gray-700 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Counts */}
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

          {/* Search Form */}
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
                <Search size={16} />
                <span>Search</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="mb-6 border-b border-gray-300 dark:border-gray-700">
        <div className="flex space-x-1">
          <button
            className={`px-6 py-3 font-semibold rounded-t-lg transition-colors ${
              activeSubTab === 'html-tools'
                ? 'bg-blue-500 text-white border-b-2 border-blue-500'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            onClick={() => setActiveSubTab('html-tools')}
          >
            HTML Tools
          </button>
          
          <button
            className="ml-auto px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center space-x-1"
            onClick={fetchTools}
            disabled={loading}
            title="Refresh tools list"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Placeholder for future admin tools */}
          <button
            className="px-6 py-3 font-semibold rounded-t-lg bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            disabled
            title="Coming soon"
          >
            Other Tools (Coming Soon)
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div>
        {activeSubTab === 'html-tools' && renderHtmlToolsTree()}
        {activeSubTab === 'search' && renderSearchResults()}
      </div>

      {/* Rating Modal */}
      {ratingModalOpen && currentRatingTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">
              Rate: {currentRatingTool.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              How would you rate this tool?
            </p>

            {/* Star Rating */}
            <div className="flex justify-center space-x-2 mb-6">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className="hover:scale-110 transition-transform"
                  onClick={() => handleRate(currentRatingTool.filename, rating)}
                  title={`${rating} star${rating > 1 ? 's' : ''}`}
                >
                  <Star
                    size={32}
                    className="text-yellow-500"
                    fill="currentColor"
                  />
                </button>
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                onClick={() => {
                  setRatingModalOpen(false);
                  setCurrentRatingTool(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTools;
