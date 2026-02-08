'use client';

import { CLUSTER_COLORS, POINT_COLORS } from '@/lib/analytics-constants';

export interface MapLegendProps {
  showSpeedColors?: boolean;
}

export function MapLegend({ showSpeedColors = false }: MapLegendProps) {
  return (
    <div className="absolute bottom-4 right-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 rounded-lg p-3 text-xs">
      <p className="text-zinc-400 mb-2 font-medium">Clusters - Individual at zoom 13+</p>

      {/* Cluster Size Legend */}
      <div className="space-y-1.5">
        <p className="text-zinc-500 text-[10px] uppercase tracking-wide">Cluster Size</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[0].color }} />
            <span className="text-zinc-400">10</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[2].color }} />
            <span className="text-zinc-400">100</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[4].color }} />
            <span className="text-zinc-400">500</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[5].color }} />
            <span className="text-zinc-400">1K+</span>
          </div>
        </div>
      </div>

      {/* Point Colors Legend - shown optionally */}
      {showSpeedColors && (
        <div className="mt-3 pt-3 border-t border-zinc-700">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1.5">Point Colors</p>
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: POINT_COLORS.alcohol }} />
              <span className="text-zinc-400">Alcohol</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: POINT_COLORS.accident }} />
              <span className="text-zinc-400">Accident</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: POINT_COLORS.citation }} />
              <span className="text-zinc-400">Citation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: POINT_COLORS.warning }} />
              <span className="text-zinc-400">Warning</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
