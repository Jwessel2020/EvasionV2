'use client';

import { X } from 'lucide-react';

export interface StopDetails {
  description?: string;
  violationType?: string;
  vehicle?: string;
  subAgency?: string;
  alcohol?: boolean;
  accident?: boolean;
  date?: string;
  time?: string;
  isSpeedRelated?: boolean;
  recordedSpeed?: number;
  postedLimit?: number;
  detectionMethod?: string;
}

export interface StopDetailsPopupProps {
  stop: StopDetails | null;
  onClose: () => void;
}

export function StopDetailsPopup({ stop, onClose }: StopDetailsPopupProps) {
  if (!stop) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 max-w-md bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 shadow-xl">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-white">Traffic Stop Details</h4>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Description */}
      {stop.description && (
        <div className="mb-3 pb-3 border-b border-zinc-700">
          <p className="text-sm text-zinc-300 leading-relaxed">
            {String(stop.description)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-zinc-400">Type:</span>
          <span className="ml-2 text-white">{String(stop.violationType || 'Unknown')}</span>
        </div>
        {stop.vehicle && (
          <div>
            <span className="text-zinc-400">Vehicle:</span>
            <span className="ml-2 text-white">{String(stop.vehicle)}</span>
          </div>
        )}
        {stop.subAgency && (
          <div className="col-span-2">
            <span className="text-zinc-400">District:</span>
            <span className="ml-2 text-white">{String(stop.subAgency)}</span>
          </div>
        )}

        {/* Speed Info */}
        {stop.isSpeedRelated && stop.recordedSpeed && stop.postedLimit && (
          <div className="col-span-2 mt-2 pt-2 border-t border-zinc-700">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-zinc-400">Speed:</span>
                <span className="ml-2 text-red-400 font-semibold">{stop.recordedSpeed} mph</span>
              </div>
              <div>
                <span className="text-zinc-400">Limit:</span>
                <span className="ml-2 text-white">{stop.postedLimit} mph</span>
              </div>
              <div>
                <span className="text-zinc-400">Over:</span>
                <span className="ml-2 text-orange-400 font-semibold">+{stop.recordedSpeed - stop.postedLimit} mph</span>
              </div>
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="col-span-2 flex flex-wrap gap-2 mt-2">
          {stop.alcohol && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
              Alcohol Related
            </span>
          )}
          {stop.accident && (
            <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded">
              Accident
            </span>
          )}
          {stop.detectionMethod && (
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded capitalize">
              {stop.detectionMethod}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
