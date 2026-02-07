import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/insights/time-patterns
 * Returns time-based enforcement patterns for driver intelligence
 *
 * Insights provided:
 * - End-of-month quota patterns
 * - Day-of-week enforcement intensity
 * - Hourly enforcement windows
 * - Monthly/seasonal patterns
 */
export async function GET() {
  try {
    // Run all pattern queries in parallel for efficiency
    const [
      dayOfMonthData,
      dayOfWeekData,
      hourlyData,
      monthlyData,
      weekendVsWeekday,
    ] = await Promise.all([
      // Query 1: Day of month pattern (quota analysis)
      prisma.$queryRaw<Array<{ day_of_month: number; count: bigint }>>`
        SELECT
          EXTRACT(DAY FROM stop_date)::int as day_of_month,
          COUNT(*) as count
        FROM traffic_violations
        WHERE stop_date IS NOT NULL
        GROUP BY day_of_month
        ORDER BY day_of_month
      `,

      // Query 2: Day of week pattern
      prisma.$queryRaw<Array<{
        day_num: number;
        count: bigint;
        avg_speed_over: number;
      }>>`
        SELECT
          EXTRACT(DOW FROM stop_date)::int as day_num,
          COUNT(*) as count,
          ROUND(AVG(speed_over)::numeric, 1) as avg_speed_over
        FROM traffic_violations
        WHERE stop_date IS NOT NULL
        GROUP BY day_num
        ORDER BY day_num
      `,

      // Query 3: Hourly pattern
      prisma.$queryRaw<Array<{
        hour: number;
        count: bigint;
        avg_speed_over: number;
      }>>`
        SELECT
          EXTRACT(HOUR FROM stop_time)::int as hour,
          COUNT(*) as count,
          ROUND(AVG(speed_over)::numeric, 1) as avg_speed_over
        FROM traffic_violations
        WHERE stop_time IS NOT NULL
        GROUP BY hour
        ORDER BY hour
      `,

      // Query 4: Monthly pattern
      prisma.$queryRaw<Array<{ month: number; count: bigint }>>`
        SELECT
          EXTRACT(MONTH FROM stop_date)::int as month,
          COUNT(*) as count
        FROM traffic_violations
        WHERE stop_date IS NOT NULL
        GROUP BY month
        ORDER BY month
      `,

      // Query 5: Weekend vs Weekday comparison
      prisma.$queryRaw<Array<{
        is_weekend: boolean;
        count: bigint;
        avg_speed_over: number;
      }>>`
        SELECT
          EXTRACT(DOW FROM stop_date) IN (0, 6) as is_weekend,
          COUNT(*) as count,
          ROUND(AVG(speed_over)::numeric, 1) as avg_speed_over
        FROM traffic_violations
        WHERE stop_date IS NOT NULL
        GROUP BY is_weekend
      `,
    ]);

    // Process day of month data (quota pattern)
    const totalTickets = dayOfMonthData.reduce((sum, d) => sum + Number(d.count), 0);
    const avgPerDay = totalTickets / 31;

    const quotaData = dayOfMonthData.map(d => ({
      dayOfMonth: d.day_of_month,
      count: Number(d.count),
      relativeRate: Math.round((Number(d.count) / avgPerDay) * 100) / 100,
    }));

    // Calculate end-of-month vs start-of-month
    const startOfMonth = quotaData.filter(d => d.dayOfMonth <= 7)
      .reduce((sum, d) => sum + d.count, 0) / 7;
    const endOfMonth = quotaData.filter(d => d.dayOfMonth >= 25)
      .reduce((sum, d) => sum + d.count, 0) / 7;
    const quotaEffect = Math.round(((endOfMonth - startOfMonth) / startOfMonth) * 100);

    // Process day of week data
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeekProcessed = dayOfWeekData.map(d => ({
      day: dayNames[d.day_num],
      dayNum: d.day_num,
      count: Number(d.count),
      avgSpeedOver: d.avg_speed_over || 0,
    }));

    const avgPerDayOfWeek = dayOfWeekProcessed.reduce((sum, d) => sum + d.count, 0) / 7;
    const highestDay = dayOfWeekProcessed.reduce((max, d) => d.count > max.count ? d : max);
    const lowestDay = dayOfWeekProcessed.reduce((min, d) => d.count < min.count ? d : min);
    const dayVariation = Math.round(((highestDay.count - lowestDay.count) / avgPerDayOfWeek) * 100);

    // Process hourly data
    const hourlyProcessed = hourlyData.map(h => {
      const count = Number(h.count);
      const avgCount = totalTickets / 24;
      const riskLevel = count > avgCount * 1.3 ? 'high'
        : count > avgCount * 0.9 ? 'moderate'
        : 'low';

      return {
        hour: h.hour,
        label: `${h.hour.toString().padStart(2, '0')}:00`,
        count,
        avgSpeedOver: h.avg_speed_over || 0,
        riskLevel,
      };
    });

    // Find peak hours (top 4 hours by count)
    const peakHours = [...hourlyProcessed]
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map(h => h.hour)
      .sort((a, b) => a - b);

    // Identify rush hour windows
    const morningRush = hourlyProcessed.filter(h => h.hour >= 7 && h.hour <= 10);
    const afternoonRush = hourlyProcessed.filter(h => h.hour >= 15 && h.hour <= 18);
    const morningTotal = morningRush.reduce((sum, h) => sum + h.count, 0);
    const afternoonTotal = afternoonRush.reduce((sum, h) => sum + h.count, 0);

    // Process monthly/seasonal data
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const avgPerMonth = totalTickets / 12;
    const monthlyProcessed = monthlyData.map(m => ({
      month: monthNames[m.month - 1],
      monthNum: m.month,
      count: Number(m.count),
      relativeRate: Math.round((Number(m.count) / avgPerMonth) * 100) / 100,
    }));

    const highestMonth = monthlyProcessed.reduce((max, m) => m.count > max.count ? m : max);
    const lowestMonth = monthlyProcessed.reduce((min, m) => m.count < min.count ? m : min);

    // Weekend vs Weekday
    const weekdayData = weekendVsWeekday.find(d => !d.is_weekend);
    const weekendData = weekendVsWeekday.find(d => d.is_weekend);

    const weekdayAvg = weekdayData ? Number(weekdayData.count) / 5 : 0;
    const weekendAvg = weekendData ? Number(weekendData.count) / 2 : 0;
    const weekendDiff = weekdayAvg > 0
      ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        quotaPattern: {
          insight: quotaEffect > 0
            ? `End of month (days 25-31) has ${quotaEffect}% more tickets than start of month (days 1-7)`
            : `No significant end-of-month quota effect detected`,
          isSignificant: Math.abs(quotaEffect) > 10,
          endOfMonthEffect: quotaEffect,
          data: quotaData,
        },

        dayOfWeek: {
          insight: `${highestDay.day} has ${dayVariation}% more tickets than ${lowestDay.day}`,
          highestDay: highestDay.day,
          lowestDay: lowestDay.day,
          data: dayOfWeekProcessed.map(d => ({
            ...d,
            relativeRate: Math.round((d.count / avgPerDayOfWeek) * 100) / 100,
          })),
        },

        hourlyPattern: {
          insight: `Peak enforcement: ${peakHours.map(h => `${h}:00`).join(', ')}`,
          peakHours,
          rushHour: {
            morning: {
              hours: '7:00-10:00 AM',
              totalTickets: morningTotal,
            },
            afternoon: {
              hours: '3:00-6:00 PM',
              totalTickets: afternoonTotal,
            },
          },
          data: hourlyProcessed,
        },

        seasonal: {
          insight: `${highestMonth.month} has highest enforcement (+${Math.round((highestMonth.relativeRate - 1) * 100)}%), ${lowestMonth.month} lowest (${Math.round((lowestMonth.relativeRate - 1) * 100)}%)`,
          highestMonth: highestMonth.month,
          lowestMonth: lowestMonth.month,
          data: monthlyProcessed,
        },

        weekendVsWeekday: {
          insight: weekendDiff < 0
            ? `Weekends have ${Math.abs(weekendDiff)}% fewer tickets per day than weekdays`
            : `Weekends have ${weekendDiff}% more tickets per day than weekdays`,
          weekdayAvgPerDay: Math.round(weekdayAvg),
          weekendAvgPerDay: Math.round(weekendAvg),
          difference: weekendDiff,
        },
      },
      meta: {
        totalRecords: totalTickets,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching time patterns:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch time patterns' },
      { status: 500 }
    );
  }
}
