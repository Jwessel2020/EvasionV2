/**
 * Centralized constants for analytics and map components
 * Eliminates duplication across components
 */

// Day names for time pattern displays
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// Month names for date displays
export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

// Violation types for filtering
export const VIOLATION_TYPES = [
  { value: null, label: 'All Types' },
  { value: 'Citation', label: 'Citation' },
  { value: 'Warning', label: 'Warning' },
  { value: 'ESERO', label: 'ESERO' },
] as const;

// Days of week filter options
export const DAYS_FILTER = [
  { value: null, label: 'All Days' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

// Time range presets for filtering
export const TIME_RANGES = [
  { value: null, label: 'All Hours' },
  { value: [0, 5] as [number, number], label: 'Late Night (12am-6am)' },
  { value: [6, 9] as [number, number], label: 'Morning Rush (6am-10am)' },
  { value: [10, 14] as [number, number], label: 'Midday (10am-3pm)' },
  { value: [15, 18] as [number, number], label: 'Evening Rush (3pm-7pm)' },
  { value: [19, 23] as [number, number], label: 'Night (7pm-12am)' },
] as const;

// Detection method options for speed violations
export const DETECTION_METHODS = [
  { value: null, label: 'All Methods' },
  { value: 'radar', label: 'Radar', icon: '📡' },
  { value: 'laser', label: 'Laser', icon: '⚡' },
  { value: 'vascar', label: 'VASCAR', icon: '⏱️' },
  { value: 'patrol', label: 'Patrol', icon: '🚔' },
] as const;

// Speed over limit filter options
export const SPEED_OVER_OPTIONS = [
  { value: null, label: 'Any Speed' },
  { value: 10, label: '10+ mph over' },
  { value: 15, label: '15+ mph over' },
  { value: 20, label: '20+ mph over' },
  { value: 25, label: '25+ mph over' },
  { value: 30, label: '30+ mph over' },
] as const;

// Detection method colors for map markers and charts
export const DETECTION_METHOD_COLORS: Record<string, { color: string; bgClass: string; textClass: string }> = {
  radar: { color: '#3b82f6', bgClass: 'bg-blue-500', textClass: 'text-blue-400' },
  laser: { color: '#dc2626', bgClass: 'bg-red-500', textClass: 'text-red-400' },
  vascar: { color: '#eab308', bgClass: 'bg-yellow-500', textClass: 'text-yellow-400' },
  patrol: { color: '#22c55e', bgClass: 'bg-green-500', textClass: 'text-green-400' },
  automated: { color: '#8b5cf6', bgClass: 'bg-purple-500', textClass: 'text-purple-400' },
  unknown: { color: '#6b7280', bgClass: 'bg-gray-500', textClass: 'text-gray-400' },
};

// Generate years from current year back to 2012
const currentYear = new Date().getFullYear();
export const YEARS_FILTER = [
  { value: null, label: 'All Years' },
  ...Array.from({ length: currentYear - 2011 }, (_, i) => ({
    value: currentYear - i,
    label: (currentYear - i).toString(),
  })),
] as const;

// Incident type quick filters
export const INCIDENT_FILTERS = [
  { key: 'hasAlcohol', label: 'Alcohol', icon: '🍺', activeColor: 'red' },
  { key: 'hasAccident', label: 'Accident', icon: '💥', activeColor: 'orange' },
  { key: 'searchConducted', label: 'Search', icon: '🔍', activeColor: 'purple' },
] as const;

// Vehicle marking options
export const VEHICLE_MARKINGS = [
  { value: 'marked', label: 'Marked', icon: '🚔' },
  { value: 'unmarked', label: 'Unmarked', icon: '🚗' },
] as const;

// Map cluster color scale
export const CLUSTER_COLORS = [
  { min: 2, color: '#06b6d4' },     // Cyan - very small
  { min: 10, color: '#3b82f6' },    // Blue - small
  { min: 50, color: '#8b5cf6' },    // Purple - medium
  { min: 200, color: '#f59e0b' },   // Amber - large
  { min: 500, color: '#f97316' },   // Orange - very large
  { min: 1000, color: '#ef4444' },  // Red - huge
  { min: 5000, color: '#dc2626' },  // Dark red - massive
] as const;

// Point colors based on violation properties
export const POINT_COLORS = {
  alcohol: '#ef4444',     // Red
  accident: '#f97316',    // Orange
  citation: '#3b82f6',    // Blue
  warning: '#22c55e',     // Green
  default: '#8b5cf6',     // Purple
} as const;

// Helper function to get color class for detection method
export function getDetectionMethodColor(method: string): string {
  return DETECTION_METHOD_COLORS[method.toLowerCase()]?.textClass ?? 'text-zinc-400';
}

// Helper function to format hour for display
export function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

// Helper to get day name by index
export function getDayName(dayIndex: number, short = false): string {
  return short ? DAY_NAMES_SHORT[dayIndex] : DAY_NAMES[dayIndex];
}
