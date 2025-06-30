import React, { useState, useEffect } from 'react';
import { 
  X, BarChart3, TrendingUp, AlertTriangle, Clock, 
  Database, Zap, Target, CheckCircle 
} from 'lucide-react';

interface PerformanceData {
  totalQueries: number;
  averageExecutionTime: number;
  totalSuggestions: number;
  criticalSuggestions: number;
  recentTrend: { date: string; avgTime: number; queryCount: number }[];
  topSuggestions: OptimizationSuggestion[];
  slowestQueries: QueryPerformance[];
}

interface OptimizationSuggestion {
  type: 'index' | 'rewrite' | 'performance' | 'structure';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestedSql?: string;
  impact: string;
}

interface QueryPerformance {
  queryId: string;
  sql: string;
  executionTime: number;
  rowsReturned: number;
  connectionId: string;
  timestamp: string;
}

interface PerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isOpen,
  onClose,
  connectionId
}) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isOpen) {
      loadPerformanceData();
    }
  }, [isOpen, connectionId]);

  const loadPerformanceData = async () => {
    setIsLoading(true);
    try {
      const queryParams = connectionId ? `?connectionId=${connectionId}` : '';
      const response = await fetch(`/api/performance/summary${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        setPerformanceData(data.data);
      }
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'index': return <Database size={16} />;
      case 'rewrite': return <Zap size={16} />;
      case 'performance': return <TrendingUp size={16} />;
      case 'structure': return <Target size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatSql = (sql: string, maxLength = 100) => {
    return sql.length > maxLength ? sql.substring(0, maxLength) + '...' : sql;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-purple-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={24} />
            <h2 className="text-xl font-semibold">Performance Dashboard</h2>
          </div>
          <button onClick={onClose} className="hover:bg-purple-700 p-1 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'suggestions', label: 'Optimization', icon: Zap },
              { id: 'trends', label: 'Trends', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading performance data...</p>
            </div>
          ) : !performanceData ? (
            <div className="text-center py-12">
              <AlertTriangle size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">No performance data available</p>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600">Total Queries</p>
                          <p className="text-2xl font-bold text-blue-900">{performanceData.totalQueries}</p>
                        </div>
                        <Database className="text-blue-600" size={24} />
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-600">Avg Execution Time</p>
                          <p className="text-2xl font-bold text-green-900">
                            {formatExecutionTime(performanceData.averageExecutionTime)}
                          </p>
                        </div>
                        <Clock className="text-green-600" size={24} />
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-yellow-600">Total Suggestions</p>
                          <p className="text-2xl font-bold text-yellow-900">{performanceData.totalSuggestions}</p>
                        </div>
                        <Zap className="text-yellow-600" size={24} />
                      </div>
                    </div>

                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-600">Critical Issues</p>
                          <p className="text-2xl font-bold text-red-900">{performanceData.criticalSuggestions}</p>
                        </div>
                        <AlertTriangle className="text-red-600" size={24} />
                      </div>
                    </div>
                  </div>

                  {/* Slowest Queries */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Slowest Queries</h3>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      {performanceData.slowestQueries.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <CheckCircle size={48} className="mx-auto mb-2 opacity-50" />
                          <p>No slow queries detected!</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {performanceData.slowestQueries.map((_query, _index) => (
                            <div key={_query.queryId} className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-500">#{_index + 1}</span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      _query.executionTime > 5000 ? 'bg-red-100 text-red-800' :
                                      _query.executionTime > 1000 ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {formatExecutionTime(_query.executionTime)}
                                    </span>
                                  </div>
                                  <code className="text-sm bg-gray-100 p-2 rounded block font-mono">
                                    {formatSql(_query.sql)}
                                  </code>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {_query.rowsReturned} rows • {new Date(_query.timestamp).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Optimization Tab */}
              {activeTab === 'suggestions' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Optimization Suggestions</h3>
                    <div className="text-sm text-gray-600">
                      {performanceData.totalSuggestions} total suggestions
                    </div>
                  </div>

                  {performanceData.topSuggestions.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No Optimization Needed!</h4>
                      <p className="text-gray-600">Your queries are performing well.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {performanceData.topSuggestions.map((_suggestion, _index) => (
                        <div key={_suggestion.type} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${getSeverityColor(_suggestion.severity)}`}>
                              {getTypeIcon(_suggestion.type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(_suggestion.severity)}`}>
                                  {_suggestion.severity.toUpperCase()}
                                </span>
                                <span className="text-xs text-gray-500 capitalize">{_suggestion.type}</span>
                              </div>
                              <p className="font-medium text-gray-900 mb-1">{_suggestion.message}</p>
                              <p className="text-sm text-gray-600 mb-2">{_suggestion.impact}</p>
                              {_suggestion.suggestedSql && (
                                <div className="bg-gray-50 p-3 rounded border">
                                  <p className="text-xs font-medium text-gray-700 mb-1">Suggested SQL:</p>
                                  <code className="text-sm font-mono text-gray-800">
                                    {_suggestion.suggestedSql}
                                  </code>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Trends Tab */}
              {activeTab === 'trends' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Performance Trends (Last 7 Days)</h3>
                  
                  {performanceData.recentTrend.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp size={48} className="mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600">No recent trend data available</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="space-y-4">
                        {performanceData.recentTrend.map((_trend, _index) => (
                          <div key={_trend.date} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                              <span className="text-sm font-medium">
                                {new Date(_trend.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                              <span>{_trend.queryCount} queries</span>
                              <span className="font-medium">
                                {formatExecutionTime(_trend.avgTime)} avg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Performance Summary */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">Performance Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Best performing day:</p>
                        <p className="font-medium">
                          {performanceData.recentTrend.length > 0 && 
                            new Date(
                              performanceData.recentTrend.reduce((best, current) => 
                                current.avgTime < best.avgTime ? current : best
                              ).date
                            ).toLocaleDateString()
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Most active day:</p>
                        <p className="font-medium">
                          {performanceData.recentTrend.length > 0 && 
                            new Date(
                              performanceData.recentTrend.reduce((most, current) => 
                                current.queryCount > most.queryCount ? current : most
                              ).date
                            ).toLocaleDateString()
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total queries this week:</p>
                        <p className="font-medium">
                          {performanceData.recentTrend.reduce((sum, trend) => sum + trend.queryCount, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 