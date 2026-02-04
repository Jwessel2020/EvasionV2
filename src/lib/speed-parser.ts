/**
 * Speed violation parsing utilities
 * Extracts speed information from traffic violation descriptions
 */

export interface SpeedInfo {
  recordedSpeed: number | null;
  postedLimit: number | null;
  speedOver: number | null;
  isHighSpeed: boolean; // 20+ mph over limit or 80+ mph
}

export interface DetectionMethodInfo {
  code: string;
  category: 'radar' | 'laser' | 'vascar' | 'patrol' | 'automated' | 'unknown';
  isMarked: boolean;
  isStationary: boolean;
  description: string;
}

/**
 * Parse speed information from a violation description
 * 
 * Handles various formats found in Maryland traffic data:
 * - "EXCEEDING POSTED MAXIMUM SPEED LIMIT: 84 MPH IN A POSTED 55 MPH ZONE"
 * - "DRIVING VEHICLE IN EXCESS OF REASONABLE AND PRUDENT SPEED ON HIGHWAY 100/55"
 * - "75 IN 45"
 * - "EXCEEDING THE POSTED SPEED LIMIT OF 55 MPH"
 */
export function parseSpeedFromDescription(description: string | null): SpeedInfo {
  if (!description) {
    return { recordedSpeed: null, postedLimit: null, speedOver: null, isHighSpeed: false };
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

  // Pattern 5: "HIGHWAY 75" at end (just recorded speed)
  if (!recordedSpeed && !postedLimit) {
    const pattern5 = /HIGHWAY\s+(\d{2,3})(?:\s*MPH)?$/i;
    const match5 = description.match(pattern5);
    if (match5) {
      recordedSpeed = parseInt(match5[1]);
    }
  }

  // Pattern 6: Just a speed value at the end "...ZONE 65"
  if (!recordedSpeed) {
    const pattern6 = /\s(\d{2,3})(?:\s*MPH)?$/i;
    const match6 = description.match(pattern6);
    if (match6) {
      const speed = parseInt(match6[1]);
      // Only accept if it looks like a reasonable speed (not a zone number)
      if (speed >= 25 && speed <= 150) {
        recordedSpeed = speed;
      }
    }
  }

  const speedOver = (recordedSpeed && postedLimit) ? recordedSpeed - postedLimit : null;
  const isHighSpeed = Boolean(
    (speedOver && speedOver >= 20) || 
    (recordedSpeed && recordedSpeed >= 80)
  );

  return { recordedSpeed, postedLimit, speedOver, isHighSpeed };
}

/**
 * Parse detection method information from arrest type string
 */
export function parseDetectionMethod(arrestType: string | null): DetectionMethodInfo {
  if (!arrestType) {
    return {
      code: '',
      category: 'unknown',
      isMarked: false,
      isStationary: false,
      description: 'Unknown',
    };
  }

  const code = arrestType.charAt(0).toUpperCase();
  const isMarked = arrestType.toLowerCase().includes('marked') && !arrestType.toLowerCase().includes('unmarked');
  const isStationary = arrestType.toLowerCase().includes('stationary');

  const methodMap: Record<string, { category: DetectionMethodInfo['category']; description: string }> = {
    'A': { category: 'patrol', description: 'Marked Patrol' },
    'B': { category: 'patrol', description: 'Unmarked Patrol' },
    'C': { category: 'vascar', description: 'Marked VASCAR' },
    'D': { category: 'vascar', description: 'Unmarked VASCAR' },
    'E': { category: 'radar', description: 'Marked Stationary Radar' },
    'F': { category: 'radar', description: 'Unmarked Stationary Radar' },
    'G': { category: 'radar', description: 'Marked Moving Radar (Stationary)' },
    'H': { category: 'radar', description: 'Unmarked Moving Radar (Stationary)' },
    'I': { category: 'radar', description: 'Marked Moving Radar (Moving)' },
    'J': { category: 'radar', description: 'Unmarked Moving Radar (Moving)' },
    'L': { category: 'patrol', description: 'Motorcycle' },
    'M': { category: 'patrol', description: 'Marked (Off-Duty)' },
    'N': { category: 'patrol', description: 'Unmarked (Off-Duty)' },
    'O': { category: 'patrol', description: 'Foot Patrol' },
    'P': { category: 'patrol', description: 'Mounted Patrol' },
    'Q': { category: 'laser', description: 'Marked Laser' },
    'R': { category: 'laser', description: 'Unmarked Laser' },
    'S': { category: 'automated', description: 'License Plate Recognition' },
  };

  const method = methodMap[code] || { category: 'unknown' as const, description: 'Unknown' };

  return {
    code,
    category: method.category,
    isMarked,
    isStationary,
    description: method.description,
  };
}

/**
 * Check if a charge code is speed-related
 */
export function isSpeedRelatedCharge(charge: string | null): boolean {
  if (!charge) return false;
  
  // Maryland speed-related statutes
  const speedCharges = [
    '21-801',     // General speed statute
    '21-801.1',   // Posted maximum speed limit
    '21-801(a)',  // Reasonable and prudent speed
    '21-801(b)',  // Special hazards
    '21-801(c)',  // School zones
    '21-801(e)',  // Business/residential districts
    '21-801(f)',  // Interstate speed limits
    '21-801(g)',  // Open country
    '21-801(h)',  // Night driving
  ];

  return speedCharges.some(c => charge.startsWith(c));
}

/**
 * Check if a description mentions speeding
 */
export function isSpeedRelatedDescription(description: string | null): boolean {
  if (!description) return false;
  
  const speedKeywords = [
    'SPEED',
    'SPEEDING',
    'EXCEED',
    'MPH',
    'REASONABLE AND PRUDENT',
  ];

  const upperDesc = description.toUpperCase();
  return speedKeywords.some(keyword => upperDesc.includes(keyword));
}

/**
 * Categorize speed violation severity
 */
export function getSpeedSeverity(speedOver: number | null): 'minor' | 'moderate' | 'major' | 'extreme' | 'unknown' {
  if (speedOver === null) return 'unknown';
  
  if (speedOver < 10) return 'minor';      // 1-9 over
  if (speedOver < 20) return 'moderate';   // 10-19 over
  if (speedOver < 30) return 'major';      // 20-29 over
  return 'extreme';                         // 30+ over
}

/**
 * Get detection method category from arrest type code
 */
export function getDetectionCategory(arrestType: string | null): string {
  if (!arrestType) return 'unknown';
  
  const code = arrestType.charAt(0).toUpperCase();
  
  if (['E', 'F', 'G', 'H', 'I', 'J'].includes(code)) return 'radar';
  if (['Q', 'R'].includes(code)) return 'laser';
  if (['C', 'D'].includes(code)) return 'vascar';
  if (['A', 'B', 'L', 'M', 'N', 'O', 'P'].includes(code)) return 'patrol';
  if (code === 'S') return 'automated';
  
  return 'unknown';
}

/**
 * Format speed for display
 */
export function formatSpeed(recordedSpeed: number | null, postedLimit: number | null): string {
  if (recordedSpeed && postedLimit) {
    return `${recordedSpeed} in a ${postedLimit} zone`;
  }
  if (recordedSpeed) {
    return `${recordedSpeed} mph`;
  }
  if (postedLimit) {
    return `${postedLimit} zone`;
  }
  return 'Unknown speed';
}

/**
 * Calculate risk score for a speed violation (0-100)
 */
export function calculateRiskScore(speedInfo: SpeedInfo, detectionMethod: DetectionMethodInfo): number {
  let score = 0;

  // Base score from speed over limit
  if (speedInfo.speedOver) {
    score += Math.min(speedInfo.speedOver * 2, 50); // Up to 50 points
  }

  // High speed bonus
  if (speedInfo.recordedSpeed && speedInfo.recordedSpeed >= 100) {
    score += 20;
  } else if (speedInfo.recordedSpeed && speedInfo.recordedSpeed >= 80) {
    score += 10;
  }

  // Detection method indicates speed trap (higher certainty)
  if (['radar', 'laser', 'vascar'].includes(detectionMethod.category)) {
    score += 10;
  }

  // Stationary detection (speed trap) indicates known problem area
  if (detectionMethod.isStationary) {
    score += 5;
  }

  return Math.min(score, 100);
}
