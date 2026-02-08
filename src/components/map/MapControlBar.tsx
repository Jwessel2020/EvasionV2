'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import {
  CircleDot,
  MapPin,
  Target,
  Focus,
  BrainCircuit,
  ChevronDown,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';

interface Pattern {
  id: string;
  type: string;
  name: string;
  description: string;
  locationCount: number;
  style: { icon: string; color: string; borderColor: string };
}

export interface MapControlBarProps {
  showPoints: boolean;
  onTogglePoints: () => void;
  showAllPoints: boolean;
  onToggleAllPoints: () => void;
  showSpeedTraps: boolean;
  onToggleSpeedTraps: () => void;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  showPatterns: boolean;
  onTogglePatterns: () => void;
  patterns: Pattern[];
  selectedPatternId: string | null;
  onSelectPattern: (patternId: string | null) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function MapControlBar({
  showPoints,
  onTogglePoints,
  showAllPoints,
  onToggleAllPoints,
  showSpeedTraps,
  onToggleSpeedTraps,
  selectionMode,
  onToggleSelectionMode,
  showPatterns,
  onTogglePatterns,
  patterns,
  selectedPatternId,
  onSelectPattern,
  isFullscreen,
  onToggleFullscreen,
}: MapControlBarProps) {
  const [patternDropdownOpen, setPatternDropdownOpen] = useState(false);

  const typeLabels: Record<string, string> = {
    'time_cluster': 'Time Clusters',
    'method_zone': 'Detection Method Zones',
    'day_pattern': 'Day Patterns',
  };

  return (
    <div className="flex items-center gap-2">
      {/* Points Toggle */}
      <Button
        variant={showPoints ? 'primary' : 'outline'}
        size="sm"
        onClick={onTogglePoints}
      >
        <CircleDot size={16} className="mr-1" />
        Points
      </Button>

      {/* Clustered/All Points Toggle */}
      <Button
        variant={showAllPoints ? 'danger' : 'outline'}
        size="sm"
        onClick={onToggleAllPoints}
        title="Show all points without clustering (may be slow)"
      >
        <MapPin size={16} className="mr-1" />
        {showAllPoints ? 'All Points' : 'Clustered'}
      </Button>

      {/* Speed Traps Toggle */}
      <Button
        variant={showSpeedTraps ? 'danger' : 'outline'}
        size="sm"
        onClick={onToggleSpeedTraps}
        title="Show identified speed trap locations"
      >
        <Target size={16} className="mr-1" />
        Speed Traps
      </Button>

      {/* Area Analysis Toggle */}
      <Button
        variant={selectionMode ? 'primary' : 'outline'}
        size="sm"
        onClick={onToggleSelectionMode}
        title="Click and drag to draw a rectangle on the map to analyze violations in that area"
      >
        <Focus size={16} className="mr-1" />
        {selectionMode ? 'Exit Analysis' : 'Analyze Area'}
      </Button>

      {/* ML Patterns Dropdown */}
      <div className="relative">
        <Button
          variant={showPatterns ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            if (!showPatterns) {
              onTogglePatterns();
              setPatternDropdownOpen(true);
            } else {
              setPatternDropdownOpen(!patternDropdownOpen);
            }
          }}
        >
          <BrainCircuit size={16} className="mr-1" />
          ML Patterns
          <ChevronDown size={14} className={`ml-1 transition-transform ${patternDropdownOpen ? 'rotate-180' : ''}`} />
        </Button>

        {/* Pattern Selector Dropdown */}
        {patternDropdownOpen && showPatterns && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-zinc-700 shadow-xl z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b border-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Discovered Patterns</span>
                <button
                  onClick={() => {
                    onTogglePatterns();
                    onSelectPattern(null);
                    setPatternDropdownOpen(false);
                  }}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Select a pattern to see its locations on the map
              </p>
            </div>

            {patterns.length === 0 ? (
              <div className="p-4 text-center text-zinc-400 text-sm">
                Loading patterns...
              </div>
            ) : (
              <div className="p-2">
                {['time_cluster', 'method_zone', 'day_pattern'].map(type => {
                  const typePatterns = patterns.filter(p => p.type === type);
                  if (typePatterns.length === 0) return null;

                  return (
                    <div key={type} className="mb-2">
                      <div className="text-xs text-zinc-500 px-2 py-1 uppercase tracking-wide">
                        {typeLabels[type] || type}
                      </div>
                      {typePatterns.map(pattern => (
                        <button
                          key={pattern.id}
                          onClick={() => {
                            onSelectPattern(selectedPatternId === pattern.id ? null : pattern.id);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                            selectedPatternId === pattern.id
                              ? 'bg-zinc-700'
                              : 'hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: pattern.style.color }}
                            />
                            <span className="text-sm text-white flex-1 truncate">
                              {pattern.name}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {pattern.locationCount}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5 pl-5 truncate">
                            {pattern.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen map'}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </Button>
    </div>
  );
}

/**
 * Selected Pattern Info Panel
 */
export interface SelectedPatternInfoProps {
  pattern: Pattern | null;
  onClose: () => void;
}

export function SelectedPatternInfo({ pattern, onClose }: SelectedPatternInfoProps) {
  if (!pattern) return null;

  return (
    <div className="absolute top-4 right-4 bg-zinc-900/95 backdrop-blur-sm rounded-lg p-3 border border-zinc-700 max-w-xs z-10">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: pattern.style.color }}
        />
        <span className="text-sm font-medium text-white">{pattern.name}</span>
        <button
          onClick={onClose}
          className="ml-auto p-1 hover:bg-zinc-700 rounded"
        >
          <X size={14} className="text-zinc-400" />
        </button>
      </div>
      <p className="text-xs text-zinc-400 mb-2">{pattern.description}</p>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-zinc-500">
          <span className="text-white font-medium">{pattern.locationCount}</span> locations
        </span>
        <span className="text-zinc-500">
          Type: <span className="text-zinc-300">{pattern.type.replace('_', ' ')}</span>
        </span>
      </div>
    </div>
  );
}
