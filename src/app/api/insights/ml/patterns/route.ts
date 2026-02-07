import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/insights/ml/patterns
 * Returns discovered ML patterns for map visualization
 *
 * Query params:
 * - patternId: Get locations for a specific pattern
 * - type: Filter by pattern type (time_cluster, method_zone, day_pattern)
 * - summary: If true, only return pattern metadata (no locations)
 * - bounds: Filter locations by map bounds "west,south,east,north"
 */

interface PatternLocation {
  gridId: string;
  lat: number;
  lng: number;
}

interface Pattern {
  pattern_id: string;
  pattern_type: string;
  name: string;
  description: string;
  location_count: number;
  locations: PatternLocation[];
  // Additional fields for specific pattern types
  peak_hour?: number;
  concentration?: number;
  method?: string;
  avg_pct?: number;
  peak_day?: string;
  day_ratio?: number;
}

interface DiscoveredPatterns {
  patterns: Pattern[];
  anomalies: unknown[];
  summary: {
    total_patterns: number;
    total_anomalies: number;
    pattern_types: Record<string, number>;
  };
}

function loadDiscoveredPatterns(): DiscoveredPatterns | null {
  try {
    const patternsPath = path.join(process.cwd(), 'ml', 'models', 'discovered_patterns_v2.0.0.json');
    if (fs.existsSync(patternsPath)) {
      const data = fs.readFileSync(patternsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading patterns:', error);
  }
  return null;
}

// Pattern type styles for UI
const PATTERN_STYLES: Record<string, { icon: string; color: string; borderColor: string }> = {
  'time_cluster': { icon: '🕐', color: '#3b82f6', borderColor: '#60a5fa' },
  'method_zone': { icon: '📡', color: '#8b5cf6', borderColor: '#a78bfa' },
  'day_pattern': { icon: '📅', color: '#10b981', borderColor: '#34d399' },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patternId = searchParams.get('patternId');
    const patternType = searchParams.get('type');
    const summaryOnly = searchParams.get('summary') === 'true';
    const bounds = searchParams.get('bounds'); // "west,south,east,north"

    const data = loadDiscoveredPatterns();

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Patterns not available. Run ML training first.' },
        { status: 503 }
      );
    }

    // If requesting a specific pattern
    if (patternId) {
      const pattern = data.patterns.find(p => p.pattern_id === patternId);

      if (!pattern) {
        return NextResponse.json(
          { success: false, error: `Pattern ${patternId} not found` },
          { status: 404 }
        );
      }

      let locations = pattern.locations;

      // Filter by bounds if provided
      if (bounds) {
        const [west, south, east, north] = bounds.split(',').map(Number);
        locations = locations.filter(loc =>
          loc.lng >= west && loc.lng <= east &&
          loc.lat >= south && loc.lat <= north
        );
      }

      const style = PATTERN_STYLES[pattern.pattern_type] || { icon: '📍', color: '#6b7280', borderColor: '#9ca3af' };

      return NextResponse.json({
        success: true,
        data: {
          pattern: {
            id: pattern.pattern_id,
            type: pattern.pattern_type,
            name: pattern.name,
            description: pattern.description,
            locationCount: pattern.location_count,
            style,
            // Type-specific fields
            ...(pattern.peak_hour !== undefined && { peakHour: pattern.peak_hour }),
            ...(pattern.concentration !== undefined && { concentration: pattern.concentration }),
            ...(pattern.method && { method: pattern.method }),
            ...(pattern.avg_pct !== undefined && { avgPct: pattern.avg_pct }),
            ...(pattern.peak_day && { peakDay: pattern.peak_day }),
            ...(pattern.day_ratio !== undefined && { dayRatio: pattern.day_ratio }),
          },
          locations: locations.slice(0, 500), // Limit for performance
          totalLocations: locations.length,
        },
      });
    }

    // Return all patterns (summary or full)
    let patterns = data.patterns;

    // Filter by type
    if (patternType) {
      patterns = patterns.filter(p => p.pattern_type === patternType);
    }

    const formattedPatterns = patterns.map(p => {
      const style = PATTERN_STYLES[p.pattern_type] || { icon: '📍', color: '#6b7280', borderColor: '#9ca3af' };

      return {
        id: p.pattern_id,
        type: p.pattern_type,
        name: p.name,
        description: p.description,
        locationCount: p.location_count,
        style,
        // Only include locations if not summary mode
        ...(summaryOnly ? {} : { locations: p.locations.slice(0, 50) }),
        // Type-specific fields
        ...(p.peak_hour !== undefined && { peakHour: p.peak_hour }),
        ...(p.concentration !== undefined && { concentration: p.concentration }),
        ...(p.method && { method: p.method }),
        ...(p.avg_pct !== undefined && { avgPct: p.avg_pct }),
        ...(p.peak_day && { peakDay: p.peak_day }),
        ...(p.day_ratio !== undefined && { dayRatio: p.day_ratio }),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        patterns: formattedPatterns,
        summary: data.summary,
        patternTypes: Object.keys(PATTERN_STYLES).map(type => ({
          type,
          ...PATTERN_STYLES[type],
          count: patterns.filter(p => p.pattern_type === type).length,
        })),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'precomputed',
      },
    });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch patterns' },
      { status: 500 }
    );
  }
}
