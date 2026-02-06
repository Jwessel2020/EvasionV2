import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/area-drilldown
 * Returns detailed analytics for a selected geographic area
 *
 * Query params:
 * - bounds: "minLng,minLat,maxLng,maxLat" (required)
 * - year: Filter by year (optional)
 * - detectionMethod: Filter by detection method (optional)
 * - speedOnly: Boolean for speed violations only (optional)
 * - minSpeedOver: Minimum speed over limit filter (optional)
 * - vehicleMake: Filter by vehicle make (optional)
 * - hasAlcohol: Filter for alcohol-related (optional)
 * - hasAccident: Filter for accidents (optional)
 * - searchConducted: Filter for stops where a search was conducted (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const boundsStr = searchParams.get('bounds');
    if (!boundsStr) {
      return NextResponse.json(
        { success: false, error: 'bounds parameter is required' },
        { status: 400 }
      );
    }

    // Parse bounds
    const bounds = boundsStr.split(',').map(Number);
    if (bounds.length !== 4) {
      return NextResponse.json(
        { success: false, error: 'Invalid bounds format. Expected: "minLng,minLat,maxLng,maxLat"' },
        { status: 400 }
      );
    }

    const [minLng, minLat, maxLng, maxLat] = bounds;

    // Get filters from query params
    const year = searchParams.get('year');
    const detectionMethod = searchParams.get('detectionMethod');
    const speedOnly = searchParams.get('speedOnly') === 'true';
    const minSpeedOver = searchParams.get('minSpeedOver') ? parseInt(searchParams.get('minSpeedOver')!) : null;
    const vehicleMake = searchParams.get('vehicleMake');
    const hasAlcohol = searchParams.get('hasAlcohol');
    const hasAccident = searchParams.get('hasAccident');
    const searchConducted = searchParams.get('searchConducted') === 'true';

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Bounds filter (required)
    conditions.push(`latitude >= $${paramIndex++} AND latitude <= $${paramIndex++}`);
    conditions.push(`longitude >= $${paramIndex++} AND longitude <= $${paramIndex++}`);
    params.push(minLat, maxLat, minLng, maxLng);

    // Year filter
    if (year) {
      conditions.push(`EXTRACT(YEAR FROM stop_date) = $${paramIndex++}`);
      params.push(parseInt(year));
    }

    // Speed only filter
    if (speedOnly) {
      conditions.push(`is_speed_related = true`);
    }

    // Minimum speed over limit filter
    if (minSpeedOver !== null) {
      conditions.push(`speed_over >= $${paramIndex++}`);
      params.push(minSpeedOver);
    }

    // Vehicle make filter
    if (vehicleMake && vehicleMake !== 'all') {
      conditions.push(`vehicle_make = $${paramIndex++}`);
      params.push(vehicleMake);
    }

    // Detection method filter
    if (detectionMethod && detectionMethod !== 'all') {
      const arrestTypeCodes = getArrestTypeCodes(detectionMethod);
      if (arrestTypeCodes.length > 0) {
        const placeholders = arrestTypeCodes.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`arrest_type IN (${placeholders})`);
        params.push(...arrestTypeCodes);
      }
    }

    // Alcohol filter
    if (hasAlcohol !== null && hasAlcohol !== undefined && hasAlcohol !== '') {
      const alcoholValue = hasAlcohol === 'true' ? 'true' : 'false';
      conditions.push(`alcohol = ${alcoholValue}`);
    }

    // Accident filter
    if (hasAccident !== null && hasAccident !== undefined && hasAccident !== '') {
      const accidentValue = hasAccident === 'true' ? 'true' : 'false';
      conditions.push(`accident = ${accidentValue}`);
    }

    // Search conducted filter
    if (searchConducted) {
      conditions.push(`search_conducted = true`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // DEBUG: Log query details
    logger.separator();
    logger.info('AREA DRILLDOWN REQUEST');
    logger.debug('Bounds', { minLng, minLat, maxLng, maxLat });
    logger.debug('WHERE clause', whereClause);
    logger.debug('Params', params);

    // Quick count to see how many violations we're dealing with
    const countQuery = `SELECT COUNT(*) as total FROM traffic_violations ${whereClause}`;
    const countResult = await prisma.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params);
    const totalViolations = Number(countResult[0]?.total || 0);
    logger.info(`Total violations in selected area: ${totalViolations}`);

    if (totalViolations > 1000) {
      logger.warn(`Large area with ${totalViolations} violations - may cause memory issues`);
    }

    logger.info('Starting 8 sequential queries (prevents memory conflicts)...');

    // Fetch all statistics SEQUENTIALLY to avoid shared memory contention
    const startTime = Date.now();
    try {
      logger.debug('Query 1/8: Summary stats');
      const summary = await getSummaryStats(whereClause, params);

      logger.debug('Query 2/8: Vehicle distribution');
      const vehicles = await getVehicleDistribution(whereClause, params);

      logger.debug('Query 3/8: Time patterns');
      const timePatterns = await getTimePatterns(whereClause, params);

      logger.debug('Query 4/8: Detection methods');
      const detectionMethods = await getDetectionMethods(whereClause, params);

      logger.debug('Query 5/8: Speed stats');
      const speedStats = speedOnly ? await getSpeedStats(whereClause, params) : null;

      logger.debug('Query 6/8: Charge types');
      const chargeTypes = await getChargeTypeBreakdown(whereClause, params);

      logger.debug('Query 7/8: Monthly distribution');
      const monthlyDistribution = await getMonthlyDistribution(whereClause, params);

      logger.debug('Query 8/8: Yearly distribution');
      const yearlyDistribution = await getYearlyDistribution(whereClause, params);

      const duration = Date.now() - startTime;
      logger.info(`All queries completed successfully in ${duration}ms`);
      logger.info(`Total stops in result: ${summary.totalStops}`);
      logger.separator();

      return NextResponse.json({
        success: true,
        data: {
          summary,
          vehicles,
          timePatterns,
          detectionMethods,
          speedStats,
          chargeTypes,
          monthlyDistribution,
          yearlyDistribution,
        },
      });
    } catch (queryError) {
      logger.error(`Query execution failed after ${Date.now() - startTime}ms`);
      logger.error('Query error', queryError);
      throw queryError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    const errorStack = error instanceof Error ? error.stack : '';

    logger.separator();
    logger.error('AREA DRILLDOWN ERROR');
    logger.error('Error type', error?.constructor?.name);
    logger.error('Error message', errorMessage);
    logger.error('Error stack', errorStack);
    logger.separator();

    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return NextResponse.json({
        success: true,
        data: {
          summary: { totalStops: 0, dateRange: { earliest: '', latest: '' }, topLocation: '' },
          vehicles: [],
          timePatterns: { byHour: [], byDay: [] },
          detectionMethods: [],
          speedStats: null,
          chargeTypes: [],
          monthlyDistribution: [],
          yearlyDistribution: [],
        },
        meta: { message: 'No data yet. Run db:import to load data.' },
      });
    }

    // Handle PostgreSQL shared memory errors - try to reduce area size
    if (errorMessage.includes('could not resize shared memory') || errorMessage.includes('No space left on device')) {
      logger.error('PostgreSQL shared memory error detected - AREA TOO LARGE');
      return NextResponse.json(
        {
          success: false,
          error: 'Selected area is too large. Please select a smaller area or try restarting the database.',
          code: 'AREA_TOO_LARGE'
        },
        { status: 413 }
      );
    }

    logger.error('Unknown error in area drill-down');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch area drill-down data' },
      { status: 500 }
    );
  }
}

/**
 * Get summary statistics
 */
async function getSummaryStats(whereClause: string, params: (string | number)[]) {
  const query = `
    SELECT
      COUNT(*) as total_stops,
      MIN(stop_date) as earliest_date,
      MAX(stop_date) as latest_date
    FROM traffic_violations
    ${whereClause}
  `;

  const result = await prisma.$queryRawUnsafe<[{
    total_stops: bigint;
    earliest_date: Date | null;
    latest_date: Date | null;
  }]>(query, ...params);

  const row = result[0];

  // Get top location
  const topLocationQuery = `
    SELECT
      location,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    AND location IS NOT NULL
    GROUP BY location
    ORDER BY count DESC
    LIMIT 1
  `;

  const topLocationResult = await prisma.$queryRawUnsafe<Array<{
    location: string;
    count: bigint;
  }>>(topLocationQuery, ...params);

  return {
    totalStops: Number(row?.total_stops || 0),
    dateRange: {
      earliest: row?.earliest_date ? row.earliest_date.toISOString() : '',
      latest: row?.latest_date ? row.latest_date.toISOString() : '',
    },
    topLocation: topLocationResult[0]?.location || '',
  };
}

/**
 * Get vehicle make distribution
 */
async function getVehicleDistribution(whereClause: string, params: (string | number)[]) {
  const query = `
    SELECT
      vehicle_make as make,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    AND vehicle_make IS NOT NULL
    GROUP BY vehicle_make
    ORDER BY count DESC
    LIMIT 10
  `;

  const results = await prisma.$queryRawUnsafe<Array<{
    make: string;
    count: bigint;
  }>>(query, ...params);

  const total = results.reduce((sum, r) => sum + Number(r.count), 0);

  return results.map(r => ({
    make: r.make,
    count: Number(r.count),
    percentage: total > 0 ? (Number(r.count) / total) * 100 : 0,
  }));
}

/**
 * Get time patterns (hourly and daily distribution)
 */
async function getTimePatterns(whereClause: string, params: (string | number)[]) {
  // Hourly distribution
  const hourlyQuery = `
    SELECT
      EXTRACT(HOUR FROM stop_time)::int as hour,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    GROUP BY hour
    ORDER BY hour
  `;

  const hourlyResults = await prisma.$queryRawUnsafe<Array<{
    hour: number;
    count: bigint;
  }>>(hourlyQuery, ...params);

  // Daily distribution
  const dailyQuery = `
    SELECT
      EXTRACT(DOW FROM stop_date)::int as day,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    GROUP BY day
    ORDER BY day
  `;

  const dailyResults = await prisma.$queryRawUnsafe<Array<{
    day: number;
    count: bigint;
  }>>(dailyQuery, ...params);

  return {
    byHour: hourlyResults.map(r => ({ hour: r.hour, count: Number(r.count) })),
    byDay: dailyResults.map(r => ({ day: r.day, count: Number(r.count) })),
  };
}

/**
 * Get detection method breakdown
 */
async function getDetectionMethods(whereClause: string, params: (string | number)[]) {
  const query = `
    SELECT
      CASE
        WHEN LEFT(arrest_type, 1) IN ('E', 'F', 'G', 'H', 'I', 'J') THEN 'radar'
        WHEN LEFT(arrest_type, 1) IN ('Q', 'R') THEN 'laser'
        WHEN LEFT(arrest_type, 1) IN ('C', 'D') THEN 'vascar'
        WHEN LEFT(arrest_type, 1) IN ('A', 'B', 'L', 'M', 'N', 'O', 'P') THEN 'patrol'
        WHEN LEFT(arrest_type, 1) = 'S' THEN 'automated'
        ELSE 'unknown'
      END as method,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    GROUP BY method
    ORDER BY count DESC
  `;

  const results = await prisma.$queryRawUnsafe<Array<{
    method: string;
    count: bigint;
  }>>(query, ...params);

  const total = results.reduce((sum, r) => sum + Number(r.count), 0);

  return results.map(r => ({
    method: r.method,
    count: Number(r.count),
    percentage: total > 0 ? (Number(r.count) / total) * 100 : 0,
  }));
}

/**
 * Get speed-specific statistics
 */
async function getSpeedStats(whereClause: string, params: (string | number)[]) {
  // Properly append the speed_over condition to the WHERE clause
  const speedCondition = whereClause
    ? `${whereClause} AND speed_over IS NOT NULL`
    : 'WHERE speed_over IS NOT NULL';

  const query = `
    SELECT
      AVG(speed_over) as avg_speed_over,
      MAX(speed_over) as max_speed_over
    FROM traffic_violations
    ${speedCondition}
  `;

  const result = await prisma.$queryRawUnsafe<[{
    avg_speed_over: number | null;
    max_speed_over: number | null;
  }]>(query, ...params);

  const row = result[0];

  return {
    avgSpeedOver: row?.avg_speed_over ? Math.round(row.avg_speed_over * 10) / 10 : 0,
    maxSpeedOver: row?.max_speed_over || 0,
  };
}

/**
 * Get charge type breakdown (warnings vs citations)
 */
async function getChargeTypeBreakdown(whereClause: string, params: (string | number)[]) {
  // Properly append the violation_type condition to the WHERE clause
  const violationCondition = whereClause
    ? `${whereClause} AND violation_type IS NOT NULL`
    : 'WHERE violation_type IS NOT NULL';

  const query = `
    SELECT
      violation_type as charge_type,
      COUNT(*) as count
    FROM traffic_violations
    ${violationCondition}
    GROUP BY charge_type
    ORDER BY count DESC
  `;

  const results = await prisma.$queryRawUnsafe<Array<{
    charge_type: string;
    count: bigint;
  }>>(query, ...params);

  const total = results.reduce((sum, r) => sum + Number(r.count), 0);

  return results.map(r => ({
    type: r.charge_type,
    count: Number(r.count),
    percentage: total > 0 ? (Number(r.count) / total) * 100 : 0,
  }));
}

/**
 * Get monthly distribution of violations
 */
async function getMonthlyDistribution(whereClause: string, params: (string | number)[]) {
  const query = `
    SELECT
      EXTRACT(MONTH FROM stop_date)::int as month,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    GROUP BY month
    ORDER BY month
  `;

  const results = await prisma.$queryRawUnsafe<Array<{
    month: number;
    count: bigint;
  }>>(query, ...params);

  // Fill in all 12 months even if no data
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: 0,
  }));

  results.forEach(r => {
    if (r.month >= 1 && r.month <= 12) {
      monthlyData[r.month - 1].count = Number(r.count);
    }
  });

  return monthlyData;
}

/**
 * Get yearly distribution of violations
 */
async function getYearlyDistribution(whereClause: string, params: (string | number)[]) {
  const query = `
    SELECT
      EXTRACT(YEAR FROM stop_date)::int as year,
      COUNT(*) as count
    FROM traffic_violations
    ${whereClause}
    GROUP BY year
    ORDER BY year
  `;

  const results = await prisma.$queryRawUnsafe<Array<{
    year: number;
    count: bigint;
  }>>(query, ...params);

  return results.map(r => ({
    year: r.year,
    count: Number(r.count),
  }));
}

/**
 * Get arrest type codes for a detection method category
 */
function getArrestTypeCodes(method: string): string[] {
  const categories: Record<string, string[]> = {
    radar: [
      'E - Marked Stationary Radar',
      'F - Unmarked Stationary Radar',
      'G - Marked Moving Radar (Stationary)',
      'H - Unmarked Moving Radar (Stationary)',
      'I - Marked Moving Radar (Moving)',
      'J - Unmarked Moving Radar (Moving)',
    ],
    laser: [
      'Q - Marked Laser',
      'R - Unmarked Laser',
    ],
    vascar: [
      'C - Marked VASCAR',
      'D - Unmarked VASCAR',
    ],
    patrol: [
      'A - Marked Patrol',
      'B - Unmarked Patrol',
      'L - Motorcycle',
      'M - Marked (Off-Duty)',
      'N - Unmarked (Off-Duty)',
      'O - Foot Patrol',
      'P - Mounted Patrol',
    ],
    automated: [
      'S - License Plate Recognition',
    ],
  };

  return categories[method] || [];
}
