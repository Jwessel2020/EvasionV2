/**
 * Map Components Exports
 */

export { MapProvider, useMap } from './MapProvider';
export { BaseMap } from './BaseMap';
export { FriendMarker } from './FriendMarker';
export { PoliceMarker } from './PoliceMarker';
export { RouteLayer } from './RouteLayer';
export { HeatmapLayer } from './HeatmapLayer';
export { PoliceStopsLayer } from './PoliceStopsLayer';
export { SpeedTrapLayer } from './SpeedTrapLayer';
export { MapFilterPanel, type MapFilters } from './MapFilterPanel';
export { HotspotMarkers } from './HotspotMarkers';
export { PredictionLayer } from './PredictionLayer';
export { PatternMarkersLayer } from './PatternMarkersLayer';
export { CarSpottingLayer } from './CarSpottingLayer';

// New extracted components
export { MapControlBar, SelectedPatternInfo, type MapControlBarProps, type SelectedPatternInfoProps } from './MapControlBar';
export { StopDetailsPopup, type StopDetails, type StopDetailsPopupProps } from './StopDetailsPopup';
export { SpeedTrapPopup, type SpeedTrapDetails, type SpeedTrapPopupProps } from './SpeedTrapPopup';
export { MapLegend, type MapLegendProps } from './MapLegend';

// Route creation components
export { WaypointMarkers, WaypointMarker } from './WaypointMarkers';
export { RoutePreviewLayer, RecordedPathLayer } from './RoutePreviewLayer';
export { RecordingOverlay, ProcessingOverlay, RoutePreviewOverlay } from './RecordingOverlay';

// Search components
export { AddressSearch } from './AddressSearch';
