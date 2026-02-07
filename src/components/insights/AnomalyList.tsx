'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  ChevronRight,
} from 'lucide-react';

interface Anomaly {
  gridId: string;
  lat: number;
  lng: number;
  type: string;
  description: string;
  zScore: number;
  pValue: number;
  expectedValue: number;
  actualValue: number;
  insight: string;
  severity: 'high' | 'medium' | 'low';
  detectedAt: string;
}

interface AnomalySummary {
  totalAnomalies: number;
  highSeverity: number;
  mediumSeverity: number;
  byType: {
    temporalSpike: number;
    enforcementSurge: number;
    enforcementDrop: number;
  };
}

interface AnomalyListProps {
  onLocationClick?: (gridId: string) => void;
}

const ANOMALY_ICONS: Record<string, React.ReactNode> = {
  temporal_spike: <Clock className="text-violet-400" size={18} />,
  enforcement_surge: <TrendingUp className="text-red-400" size={18} />,
  enforcement_drop: <TrendingDown className="text-blue-400" size={18} />,
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'border-red-500/50 bg-red-500/10',
  medium: 'border-yellow-500/50 bg-yellow-500/10',
  low: 'border-gray-500/50 bg-gray-500/10',
};

const SEVERITY_BADGES: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function AnomalyList({ onLocationClick }: AnomalyListProps) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnomalies() {
      try {
        const response = await fetch('/api/insights/ml/anomalies');
        const result = await response.json();

        if (result.success) {
          setAnomalies(result.data.anomalies);
          setSummary(result.data.summary);
        } else {
          setError(result.error || 'Failed to load anomalies');
        }
      } catch (err) {
        setError('Failed to fetch anomalies');
      } finally {
        setLoading(false);
      }
    }

    fetchAnomalies();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-48 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-gray-700 rounded" />
          <div className="h-16 bg-gray-700 rounded" />
          <div className="h-16 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-red-400 flex items-center gap-2">
          <AlertTriangle size={18} />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{summary.totalAnomalies}</div>
            <div className="text-xs text-gray-400">Total Anomalies</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{summary.highSeverity}</div>
            <div className="text-xs text-gray-400">High Severity</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{summary.mediumSeverity}</div>
            <div className="text-xs text-gray-400">Medium Severity</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-violet-400">{summary.byType.temporalSpike}</div>
            <div className="text-xs text-gray-400">Temporal Spikes</div>
          </div>
        </div>
      )}

      {/* Anomaly List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="text-yellow-400" size={20} />
          Detected Anomalies
        </h3>

        {anomalies.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
            No anomalies detected. This is good - enforcement patterns are within expected ranges.
          </div>
        ) : (
          <div className="space-y-3">
            {anomalies.map((anomaly, idx) => (
              <div
                key={`${anomaly.gridId}-${idx}`}
                className={`rounded-lg border p-4 ${SEVERITY_COLORS[anomaly.severity]}`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-0.5">
                    {ANOMALY_ICONS[anomaly.type] || <AlertTriangle size={18} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{anomaly.description}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${SEVERITY_BADGES[anomaly.severity]}`}>
                        {anomaly.severity}
                      </span>
                    </div>

                    <p className="text-sm text-gray-300 mb-2">{anomaly.insight}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                      <span>
                        Z-score: <span className="text-white">{anomaly.zScore.toFixed(2)}</span>
                      </span>
                      <span>
                        Expected: <span className="text-white">{anomaly.expectedValue.toFixed(1)}</span>
                      </span>
                      <span>
                        Actual: <span className="text-white">{anomaly.actualValue}</span>
                      </span>
                    </div>
                  </div>

                  {/* Location Button */}
                  <button
                    onClick={() => onLocationClick?.(anomaly.gridId)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    <MapPin size={14} className="text-gray-400" />
                    <span className="text-gray-300 font-mono">
                      {anomaly.lat.toFixed(3)}
                    </span>
                    <ChevronRight size={14} className="text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
