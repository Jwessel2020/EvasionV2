'use client';

import { X, Target } from 'lucide-react';

export interface SpeedTrapDetails {
  trapScore?: number;
  stopCount?: number;
  uniqueDays?: number;
  avgSpeedOver?: number;
  maxSpeedOver?: number;
  primaryMethod?: string;
  location?: string;
}

export interface SpeedTrapPopupProps {
  trap: SpeedTrapDetails | null;
  onClose: () => void;
}

export function SpeedTrapPopup({ trap, onClose }: SpeedTrapPopupProps) {
  if (!trap) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 max-w-md bg-zinc-900/95 backdrop-blur-sm border border-red-800/50 rounded-xl p-4 shadow-xl">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="text-red-500" size={20} />
          <h4 className="font-semibold text-white">Speed Trap Location</h4>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Trap Score */}
        <div className="bg-zinc-800/50 rounded-lg p-2.5">
          <p className="text-zinc-400 text-xs mb-1">Trap Score</p>
          <p className="text-2xl font-bold text-red-500">
            {trap.trapScore ? Number(trap.trapScore).toFixed(0) : 'N/A'}
          </p>
        </div>

        {/* Total Stops */}
        <div className="bg-zinc-800/50 rounded-lg p-2.5">
          <p className="text-zinc-400 text-xs mb-1">Total Stops</p>
          <p className="text-2xl font-bold text-white">
            {trap.stopCount ? Number(trap.stopCount) : 'N/A'}
          </p>
        </div>

        {/* Unique Days */}
        <div className="bg-zinc-800/50 rounded-lg p-2.5">
          <p className="text-zinc-400 text-xs mb-1">Unique Days</p>
          <p className="text-lg font-semibold text-white">
            {trap.uniqueDays ? Number(trap.uniqueDays) : 'N/A'}
          </p>
        </div>

        {/* Avg Speed Over */}
        <div className="bg-zinc-800/50 rounded-lg p-2.5">
          <p className="text-zinc-400 text-xs mb-1">Avg. Speed Over</p>
          <p className="text-lg font-semibold text-violet-400">
            {trap.avgSpeedOver ? `+${Number(trap.avgSpeedOver)} mph` : 'N/A'}
          </p>
        </div>

        {/* Max Speed Over */}
        {trap.maxSpeedOver && (
          <div className="bg-zinc-800/50 rounded-lg p-2.5">
            <p className="text-zinc-400 text-xs mb-1">Max Speed Over</p>
            <p className="text-lg font-semibold text-red-400">
              +{Number(trap.maxSpeedOver)} mph
            </p>
          </div>
        )}

        {/* Detection Method */}
        {trap.primaryMethod && (
          <div className="bg-zinc-800/50 rounded-lg p-2.5">
            <p className="text-zinc-400 text-xs mb-1">Detection</p>
            <p className="text-lg font-semibold text-white capitalize">
              {String(trap.primaryMethod)}
            </p>
          </div>
        )}

        {/* Location */}
        {trap.location && (
          <div className="col-span-2 bg-zinc-800/50 rounded-lg p-2.5">
            <p className="text-zinc-400 text-xs mb-1">Location</p>
            <p className="text-white text-sm">
              {String(trap.location)}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        High speed enforcement area - {trap.stopCount || 0} stops over {trap.uniqueDays || 0} days
      </p>
    </div>
  );
}
