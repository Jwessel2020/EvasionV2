/**
 * Backfill script to populate speed analysis columns in traffic_violations table
 * 
 * This script:
 * 1. Identifies speed-related violations by charge code (21-801*)
 * 2. Parses recorded speed and posted limit from description field
 * 3. Calculates speed over limit
 * 4. Categorizes detection method from arrest_type
 * 
 * Run with: npx tsx scripts/backfill-speed-data.ts
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const BATCH_SIZE = 5000;

interface SpeedInfo {
  recordedSpeed: number | null;
  postedLimit: number | null;
  speedOver: number | null;
}

/**
 * Parse speed information from description
 */
function parseSpeedFromDescription(description: string | null): SpeedInfo {
  if (!description) {
    return { recordedSpeed: null, postedLimit: null, speedOver: null };
  }

  let recordedSpeed: number | null = null;
  let postedLimit: number | null = null;

  // Pattern 1: "84 MPH IN A POSTED 55 MPH ZONE" or variants
  const pattern1 = /(\d{2,3})\s*MPH\s*IN\s*(?:A\s*)?(?:POSTED\s*)?(\d{2,3})\s*MPH/i;
  const match1 = description.match(pattern1);
  if (match1) {
    recordedSpeed = parseInt(match1[1]);
    postedLimit = parseInt(match1[2]);
  }

  // Pattern 2: "100/55" format
  if (!recordedSpeed) {
    const pattern2 = /(\d{2,3})\/(\d{2,3})/;
    const match2 = description.match(pattern2);
    if (match2) {
      recordedSpeed = parseInt(match2[1]);
      postedLimit = parseInt(match2[2]);
    }
  }

  // Pattern 3: "75 IN 45" or "75 IN A 45"
  if (!recordedSpeed) {
    const pattern3 = /(\d{2,3})\s+IN\s+(?:A\s+)?(\d{2,3})(?:\s*MPH)?/i;
    const match3 = description.match(pattern3);
    if (match3) {
      recordedSpeed = parseInt(match3[1]);
      postedLimit = parseInt(match3[2]);
    }
  }

  // Pattern 4: "POSTED SPEED LIMIT OF 55 MPH" (only limit)
  if (!postedLimit) {
    const pattern4 = /(?:POSTED\s*)?(?:SPEED\s*)?LIMIT\s*(?:OF\s*)?(\d{2,3})\s*MPH/i;
    const match4 = description.match(pattern4);
    if (match4) {
      postedLimit = parseInt(match4[1]);
    }
  }

  // Pattern 5: "HIGHWAY 75" at end
  if (!recordedSpeed && !postedLimit) {
    const pattern5 = /HIGHWAY\s+(\d{2,3})(?:\s*MPH)?$/i;
    const match5 = description.match(pattern5);
    if (match5) {
      recordedSpeed = parseInt(match5[1]);
    }
  }

  const speedOver = (recordedSpeed && postedLimit) ? recordedSpeed - postedLimit : null;

  return { recordedSpeed, postedLimit, speedOver };
}

/**
 * Get detection method category from arrest type
 */
function getDetectionMethod(arrestType: string | null): string | null {
  if (!arrestType) return null;
  
  const code = arrestType.charAt(0).toUpperCase();
  
  if (['E', 'F', 'G', 'H', 'I', 'J'].includes(code)) return 'radar';
  if (['Q', 'R'].includes(code)) return 'laser';
  if (['C', 'D'].includes(code)) return 'vascar';
  if (['A', 'B', 'L', 'M', 'N', 'O', 'P'].includes(code)) return 'patrol';
  if (code === 'S') return 'automated';
  
  return null;
}

/**
 * Check if charge is speed-related
 */
function isSpeedRelatedCharge(charge: string | null): boolean {
  if (!charge) return false;
  return charge.startsWith('21-801');
}

async function backfillSpeedData() {
  console.log('Starting speed data backfill...\n');
  
  // Get total count of records
  const totalCount = await prisma.trafficViolation.count();
  console.log(`Total records in database: ${totalCount.toLocaleString()}`);
  
  // Count speed-related records (by charge)
  const speedCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM traffic_violations WHERE charge LIKE '21-801%'
  `;
  console.log(`Speed-related records (charge 21-801*): ${Number(speedCount[0].count).toLocaleString()}`);
  
  // Process in batches
  let processed = 0;
  let updated = 0;
  let speedParsed = 0;
  let offset = 0;
  
  console.log(`\nProcessing in batches of ${BATCH_SIZE}...`);
  
  while (offset < totalCount) {
    // Fetch batch
    const batch = await prisma.$queryRaw<Array<{
      id: string;
      charge: string | null;
      description: string | null;
      arrest_type: string | null;
    }>>`
      SELECT id, charge, description, arrest_type 
      FROM traffic_violations 
      ORDER BY id
      OFFSET ${offset}
      LIMIT ${BATCH_SIZE}
    `;
    
    if (batch.length === 0) break;
    
    // Prepare updates
    const updates: Array<{
      id: string;
      isSpeedRelated: boolean;
      recordedSpeed: number | null;
      postedLimit: number | null;
      speedOver: number | null;
      detectionMethod: string | null;
    }> = [];
    
    for (const row of batch) {
      const isSpeed = isSpeedRelatedCharge(row.charge);
      const speedInfo = isSpeed ? parseSpeedFromDescription(row.description) : { recordedSpeed: null, postedLimit: null, speedOver: null };
      const detectionMethod = getDetectionMethod(row.arrest_type);
      
      if (isSpeed || detectionMethod) {
        updates.push({
          id: row.id,
          isSpeedRelated: isSpeed,
          recordedSpeed: speedInfo.recordedSpeed,
          postedLimit: speedInfo.postedLimit,
          speedOver: speedInfo.speedOver,
          detectionMethod,
        });
        
        if (speedInfo.recordedSpeed || speedInfo.postedLimit) {
          speedParsed++;
        }
      }
    }
    
    // Batch update using raw SQL for performance
    if (updates.length > 0) {
      // Build bulk update query
      const updatePromises = updates.map(u => 
        prisma.$executeRaw`
          UPDATE traffic_violations 
          SET 
            is_speed_related = ${u.isSpeedRelated},
            recorded_speed = ${u.recordedSpeed},
            posted_limit = ${u.postedLimit},
            speed_over = ${u.speedOver},
            detection_method = ${u.detectionMethod}
          WHERE id = ${u.id}::uuid
        `
      );
      
      await Promise.all(updatePromises);
      updated += updates.length;
    }
    
    processed += batch.length;
    offset += BATCH_SIZE;
    
    // Progress update
    const progress = ((processed / totalCount) * 100).toFixed(1);
    process.stdout.write(`\rProcessed: ${processed.toLocaleString()} / ${totalCount.toLocaleString()} (${progress}%) | Updated: ${updated.toLocaleString()} | Speed parsed: ${speedParsed.toLocaleString()}`);
  }
  
  console.log('\n\n✅ Backfill complete!');
  console.log(`   Total processed: ${processed.toLocaleString()}`);
  console.log(`   Records updated: ${updated.toLocaleString()}`);
  console.log(`   Speeds parsed: ${speedParsed.toLocaleString()}`);
  
  // Show summary stats
  console.log('\n📊 Summary Statistics:');
  
  const stats = await prisma.$queryRaw<Array<{ 
    detection_method: string | null; 
    count: bigint;
    avg_speed_over: number | null;
  }>>`
    SELECT 
      detection_method,
      COUNT(*) as count,
      AVG(speed_over) as avg_speed_over
    FROM traffic_violations 
    WHERE is_speed_related = true
    GROUP BY detection_method
    ORDER BY count DESC
  `;
  
  console.log('\nBy Detection Method:');
  for (const row of stats) {
    const method = row.detection_method || 'unknown';
    const avgOver = row.avg_speed_over ? row.avg_speed_over.toFixed(1) : 'N/A';
    console.log(`   ${method.padEnd(12)} ${Number(row.count).toLocaleString().padStart(10)} stops (avg ${avgOver} over)`);
  }
  
  const highSpeed = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM traffic_violations WHERE speed_over >= 20
  `;
  console.log(`\nHigh-speed violations (20+ over): ${Number(highSpeed[0].count).toLocaleString()}`);
  
  const extreme = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM traffic_violations WHERE recorded_speed >= 100
  `;
  console.log(`Extreme speed (100+ mph): ${Number(extreme[0].count).toLocaleString()}`);
}

// Run the backfill
backfillSpeedData()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
