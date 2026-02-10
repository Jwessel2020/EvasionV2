'use client';

interface RouteThumbnailProps {
  coordinates: [number, number][];
  color?: string;
  glowColor?: string;
  className?: string;
}

export function RouteThumbnail({
  coordinates,
  color = '#8b5cf6',
  glowColor,
  className = '',
}: RouteThumbnailProps) {
  if (!coordinates || coordinates.length < 2) return null;

  // Simplify to max ~80 points for performance
  const step = Math.max(1, Math.floor(coordinates.length / 80));
  const simplified = coordinates.filter((_, i) => i % step === 0 || i === coordinates.length - 1);

  // Find bounding box
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const [lng, lat] of simplified) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const lngRange = maxLng - minLng || 0.001;
  const latRange = maxLat - minLat || 0.001;

  // Add padding
  const padding = 16;
  const viewWidth = 200;
  const viewHeight = 140;
  const drawWidth = viewWidth - padding * 2;
  const drawHeight = viewHeight - padding * 2;

  // Scale coordinates to fit viewBox, maintaining aspect ratio
  const scaleX = drawWidth / lngRange;
  const scaleY = drawHeight / latRange;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = padding + (drawWidth - lngRange * scale) / 2;
  const offsetY = padding + (drawHeight - latRange * scale) / 2;

  // Convert to SVG points (flip Y since lat increases upward but SVG Y goes down)
  const points = simplified.map(([lng, lat]) => {
    const x = offsetX + (lng - minLng) * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return `${x},${y}`;
  }).join(' ');

  const glow = glowColor || color;

  // Start and end points
  const startCoord = simplified[0];
  const endCoord = simplified[simplified.length - 1];
  const startX = offsetX + (startCoord[0] - minLng) * scale;
  const startY = offsetY + (maxLat - startCoord[1]) * scale;
  const endX = offsetX + (endCoord[0] - minLng) * scale;
  const endY = offsetY + (maxLat - endCoord[1]) * scale;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      className={`w-full h-full ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id={`glow-${color.replace('#', '')}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow line */}
      <polyline
        points={points}
        fill="none"
        stroke={glow}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        filter={`url(#glow-${color.replace('#', '')})`}
      />

      {/* Main route line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {/* Start point */}
      <circle cx={startX} cy={startY} r="4" fill="#22c55e" stroke="#09090b" strokeWidth="1.5" />

      {/* End point */}
      <circle cx={endX} cy={endY} r="4" fill="#ef4444" stroke="#09090b" strokeWidth="1.5" />
    </svg>
  );
}
