'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Radio,
  Calendar,
  TrendingUp,
  MapPin,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

interface Pattern {
  patternId: string;
  patternType: string;
  name: string;
  description: string;
  locationCount: number;
  locations: Array<{ gridId: string; lat: number; lng: number }>;
  confidence: number;
  statistics: Record<string, unknown>;
  insight: string;
}

interface PatternSummary {
  totalPatterns: number;
  timeClusters: number;
  methodZones: number;
  dayPatterns: number;
  quotaEffectDetected: boolean;
}

interface PatternDiscoveryProps {
  onLocationClick?: (gridId: string) => void;
}

const PATTERN_ICONS: Record<string, React.ReactNode> = {
  time_cluster: <Clock className="text-blue-400" size={20} />,
  method_zone: <Radio className="text-purple-400" size={20} />,
  day_pattern: <Calendar className="text-green-400" size={20} />,
  quota_effect: <TrendingUp className="text-yellow-400" size={20} />,
};

const PATTERN_COLORS: Record<string, string> = {
  time_cluster: 'border-blue-500/30 bg-blue-500/5',
  method_zone: 'border-purple-500/30 bg-purple-500/5',
  day_pattern: 'border-green-500/30 bg-green-500/5',
  quota_effect: 'border-yellow-500/30 bg-yellow-500/5',
};

export function PatternDiscovery({ onLocationClick }: PatternDiscoveryProps) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [summary, setSummary] = useState<PatternSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchPatterns() {
      try {
        const response = await fetch('/api/insights/ml/patterns');
        const result = await response.json();

        if (result.success) {
          setPatterns(result.data.patterns);
          setSummary(result.data.summary);
        } else {
          setError(result.error || 'Failed to load patterns');
        }
      } catch (err) {
        setError('Failed to fetch patterns');
      } finally {
        setLoading(false);
      }
    }

    fetchPatterns();
  }, []);

  const togglePattern = (patternId: string) => {
    const newExpanded = new Set(expandedPatterns);
    if (newExpanded.has(patternId)) {
      newExpanded.delete(patternId);
    } else {
      newExpanded.add(patternId);
    }
    setExpandedPatterns(newExpanded);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-48 mb-4" />
        <div className="space-y-3">
          <div className="h-20 bg-gray-700 rounded" />
          <div className="h-20 bg-gray-700 rounded" />
          <div className="h-20 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-red-400 flex items-center gap-2">
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{summary.totalPatterns}</div>
            <div className="text-xs text-gray-400">Total Patterns</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{summary.timeClusters}</div>
            <div className="text-xs text-gray-400">Time Clusters</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{summary.methodZones}</div>
            <div className="text-xs text-gray-400">Method Zones</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{summary.dayPatterns}</div>
            <div className="text-xs text-gray-400">Day Patterns</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className={`text-2xl font-bold ${summary.quotaEffectDetected ? 'text-yellow-400' : 'text-gray-500'}`}>
              {summary.quotaEffectDetected ? 'Yes' : 'No'}
            </div>
            <div className="text-xs text-gray-400">Quota Effect</div>
          </div>
        </div>
      )}

      {/* Pattern List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Zap className="text-yellow-400" size={20} />
          Discovered Patterns
        </h3>

        {patterns.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
            No patterns discovered yet. Run the ML pipeline to discover patterns.
          </div>
        ) : (
          <div className="space-y-3">
            {patterns.map((pattern, index) => (
              <div
                key={pattern.patternId || `pattern-${index}`}
                className={`rounded-lg border ${PATTERN_COLORS[pattern.patternType] || 'border-gray-700 bg-gray-800'}`}
              >
                {/* Pattern Header */}
                <button
                  onClick={() => togglePattern(pattern.patternId)}
                  className="w-full p-4 flex items-start gap-3 text-left"
                >
                  <div className="mt-0.5">
                    {PATTERN_ICONS[pattern.patternType] || <Zap size={20} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white">{pattern.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                          {Math.round(pattern.confidence * 100)}% confidence
                        </span>
                        {expandedPatterns.has(pattern.patternId) ? (
                          <ChevronUp size={16} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{pattern.description}</p>
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedPatterns.has(pattern.patternId) && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="border-t border-gray-700 pt-4">
                      {/* Insight */}
                      <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-300">{pattern.insight}</p>
                      </div>

                      {/* Statistics */}
                      {Object.keys(pattern.statistics).length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-gray-400 mb-2">Statistics</h5>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            {Object.entries(pattern.statistics).map(([key, value]) => (
                              <div key={key} className="bg-gray-900/50 rounded px-2 py-1">
                                <span className="text-xs text-gray-500">{key.replace(/_/g, ' ')}: </span>
                                <span className="text-sm text-white">
                                  {typeof value === 'number'
                                    ? value < 1
                                      ? `${Math.round(value * 100)}%`
                                      : value.toFixed(1)
                                    : Array.isArray(value)
                                    ? value.join(', ')
                                    : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Locations */}
                      {pattern.locations.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-400 mb-2">
                            Locations ({pattern.locationCount} total)
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {pattern.locations.slice(0, 8).map((loc) => (
                              <button
                                key={loc.gridId}
                                onClick={() => onLocationClick?.(loc.gridId)}
                                className="flex items-center gap-1 px-2 py-1 bg-gray-900/50 rounded text-sm hover:bg-gray-700 transition-colors"
                              >
                                <MapPin size={12} className="text-gray-400" />
                                <span className="text-gray-300 font-mono text-xs">
                                  {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}
                                </span>
                              </button>
                            ))}
                            {pattern.locationCount > 8 && (
                              <span className="text-sm text-gray-500 px-2 py-1">
                                +{pattern.locationCount - 8} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
