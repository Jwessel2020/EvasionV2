'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapProvider, BaseMap, FriendMarker, PoliceMarker, HeatmapLayer, SpeedTrapLayer } from '@/components/map';
import { Button } from '@/components/ui';
import { PredictionPanel } from '@/components/analytics';
import { useGeolocation } from '@/hooks';
import { useLocationStore } from '@/stores';
import type { LiveUserPin, PoliceAlert } from '@/types';
import { 
  Navigation, 
  Users, 
  AlertTriangle, 
  Wifi,
  WifiOff,
  Plus,
  Locate,
  X,
  Layers,
  Target
} from 'lucide-react';

// Mock data for demo - replace with real-time data later
const MOCK_FRIENDS: LiveUserPin[] = [
  {
    id: '1',
    userId: 'user-1',
    username: 'speedracer',
    displayName: 'Alex Rodriguez',
    avatarUrl: null,
    location: { latitude: 34.0522, longitude: -118.2437 },
    heading: 45,
    speed: 65,
    lastUpdated: Date.now(),
  },
  {
    id: '2',
    userId: 'user-2',
    username: 'midnight_cruiser',
    displayName: 'Sarah Chen',
    avatarUrl: null,
    location: { latitude: 34.0195, longitude: -118.4912 },
    heading: 180,
    speed: 35,
    lastUpdated: Date.now(),
  },
];

const MOCK_ALERTS: PoliceAlert[] = [
  {
    id: '1',
    reporterId: 'user-3',
    location: { latitude: 34.0407, longitude: -118.2468 },
    reportType: 'SPEED_TRAP',
    description: 'Speed trap on the 101',
    confirmations: 5,
    reportedAt: Date.now() - 300000, // 5 min ago
    expiresAt: Date.now() + 1500000, // 25 min from now
  },
];

export default function MapPage() {
  const { location, isLoading: locationLoading, error: locationError, refresh: refreshLocation } = useGeolocation({ watchPosition: true });
  const { isBroadcasting, setBroadcasting } = useLocationStore();
  
  const [friends, setFriends] = useState<LiveUserPin[]>(MOCK_FRIENDS);
  const [alerts, setAlerts] = useState<PoliceAlert[]>(MOCK_ALERTS);
  const [showFriends, setShowFriends] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSpeedTraps, setShowSpeedTraps] = useState(true); // Show speed traps by default - v6
  const [heatmapData, setHeatmapData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<LiveUserPin | null>(null);
  const [selectedTrap, setSelectedTrap] = useState<Record<string, unknown> | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Fetch heatmap data
  useEffect(() => {
    if (showHeatmap && !heatmapData) {
      fetch('/api/analytics/heatmap')
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then(json => {
          if (json.success) {
            setHeatmapData(json.data);
          }
        })
        .catch(err => {
          console.warn('Failed to load heatmap data:', err.message);
          // Heatmap will be empty until data is imported
        });
    }
  }, [showHeatmap, heatmapData]);

  // Initial center on user location if available
  const initialCenter: [number, number] = location 
    ? [location.longitude, location.latitude] 
    : [-118.2437, 34.0522]; // LA default
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MapPage.tsx:render',message:'MAP_PAGE_RENDER_V6',data:{showSpeedTraps,selectedTrap:!!selectedTrap,selectedFriend:!!selectedFriend,codeVersion:'v6-feb4'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F',runId:'post-fix-6'})}).catch(()=>{});
  console.log('[DEBUG-V6] MapPage render - showSpeedTraps:', showSpeedTraps);
  // #endregion

  const handleToggleBroadcast = useCallback(() => {
    setBroadcasting(!isBroadcasting);
    // TODO: Connect to Socket.io to broadcast location
  }, [isBroadcasting, setBroadcasting]);

  const handleFriendClick = useCallback((friend: LiveUserPin) => {
    setSelectedFriend(friend);
  }, []);

  const handleAlertClick = useCallback((alert: PoliceAlert) => {
    // TODO: Show alert details / confirm modal
    console.log('Alert clicked:', alert);
  }, []);

  return (
    <div className="h-[calc(100vh-8rem)] relative">
      <MapProvider>
        <BaseMap 
          initialCenter={initialCenter}
          initialZoom={location ? 13 : 10}
          className="w-full h-full rounded-xl overflow-hidden border border-zinc-800"
        >
          {/* Friend markers */}
          {showFriends && friends.map((friend) => (
            <FriendMarker 
              key={friend.id} 
              friend={friend} 
              onClick={handleFriendClick}
            />
          ))}

          {/* Police alert markers */}
          {showAlerts && alerts.map((alert) => (
            <PoliceMarker 
              key={alert.id} 
              alert={alert}
              onClick={handleAlertClick}
            />
          ))}
          
          {/* Historical heatmap layer */}
          <HeatmapLayer
            data={heatmapData}
            visible={showHeatmap}
            radius={25}
            intensity={1.2}
            opacity={0.6}
          />
          
          {/* Speed trap markers from historical data */}
          <SpeedTrapLayer
            visible={showSpeedTraps}
            minStops={5}
            onTrapClick={(props) => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MapPage.tsx:onTrapClick',message:'TRAP PIN CLICKED',data:{props:JSON.stringify(props).slice(0,200)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'R',runId:'post-fix-7'})}).catch(()=>{});
              console.log('[DEBUG-V7] Trap pin clicked:', props);
              // #endregion
              setSelectedTrap(props);
              setSelectedFriend(null); // Close other panels
            }}
          />
        </BaseMap>

        {/* Top controls */}
        <div className="absolute top-4 left-4 flex gap-2">
          <Button
            variant={isBroadcasting ? 'primary' : 'secondary'}
            size="sm"
            onClick={handleToggleBroadcast}
            className="shadow-lg"
          >
            {isBroadcasting ? (
              <>
                <Wifi size={16} className="mr-2 animate-pulse" />
                Broadcasting
              </>
            ) : (
              <>
                <WifiOff size={16} className="mr-2" />
                Go Live
              </>
            )}
          </Button>
        </div>

        {/* Filter controls */}
        <div className="absolute top-4 right-20 flex gap-2 flex-wrap justify-end">
          <Button
            variant={showFriends ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setShowFriends(!showFriends)}
            className="shadow-lg"
          >
            <Users size={16} className="mr-1" />
            Friends ({friends.length})
          </Button>
          <Button
            variant={showAlerts ? 'danger' : 'outline'}
            size="sm"
            onClick={() => setShowAlerts(!showAlerts)}
            className="shadow-lg"
          >
            <AlertTriangle size={16} className="mr-1" />
            Alerts ({alerts.length})
          </Button>
          <Button
            variant={showSpeedTraps ? 'danger' : 'outline'}
            size="sm"
            onClick={() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8ecbc98d-1e8e-44c9-8f10-253e23d24891',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MapPage.tsx:toggleSpeedTraps',message:'Toggle clicked',data:{currentValue:showSpeedTraps,newValue:!showSpeedTraps},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K',runId:'post-fix-5'})}).catch(()=>{});
              // #endregion
              setShowSpeedTraps(!showSpeedTraps);
            }}
            className="shadow-lg"
            title="Show known speed trap locations based on historical data"
          >
            <Target size={16} className="mr-1" />
            Speed Traps
          </Button>
          <Button
            variant={showHeatmap ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="shadow-lg"
          >
            <Layers size={16} className="mr-1" />
            Heatmap
          </Button>
        </div>
        
        {/* Prediction panel */}
        <PredictionPanel
          userLocation={location ? { latitude: location.latitude, longitude: location.longitude } : null}
          className="absolute top-16 right-4 w-80"
        />

        {/* Report button */}
        <div className="absolute bottom-6 right-6">
          <Button
            variant="danger"
            size="lg"
            onClick={() => setShowReportModal(true)}
            className="shadow-xl rounded-full w-14 h-14 p-0"
          >
            <Plus size={24} />
          </Button>
        </div>

        {/* Location status */}
        <div className="absolute bottom-6 left-6 bg-zinc-900/90 backdrop-blur-sm rounded-lg p-3 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${location ? 'bg-green-500' : 'bg-zinc-500'} ${isBroadcasting ? 'animate-pulse' : ''}`} />
            <div className="text-sm">
              {locationLoading ? (
                <span className="text-zinc-400">Getting location...</span>
              ) : locationError ? (
                <span className="text-red-400">{locationError}</span>
              ) : location ? (
                <span className="text-zinc-300">
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </span>
              ) : (
                <span className="text-zinc-400">Location unavailable</span>
              )}
            </div>
            <button 
              onClick={refreshLocation}
              className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
            >
              <Locate size={16} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Selected friend panel */}
        {selectedFriend && (
          <div className="absolute top-20 left-4 w-72 bg-zinc-900/95 backdrop-blur-sm rounded-xl border border-zinc-800 p-4 shadow-xl animate-fade-in">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-500 font-bold text-lg">
                    {selectedFriend.displayName.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-white">{selectedFriend.displayName}</h3>
                  <p className="text-sm text-zinc-400">@{selectedFriend.username}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedFriend(null)}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
              >
                <X size={18} className="text-zinc-400" />
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              {selectedFriend.speed !== undefined && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Speed</span>
                  <span className="text-white font-medium">{Math.round(selectedFriend.speed)} mph</span>
                </div>
              )}
              {selectedFriend.heading !== undefined && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Heading</span>
                  <span className="text-white font-medium">{Math.round(selectedFriend.heading)}°</span>
                </div>
              )}
              {selectedFriend.vehicleName && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Vehicle</span>
                  <span className="text-orange-400 font-medium">{selectedFriend.vehicleName}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                Message
              </Button>
              <Button variant="primary" size="sm" className="flex-1">
                <Navigation size={14} className="mr-1" />
                Navigate
              </Button>
            </div>
          </div>
        )}

        {/* Selected speed trap panel */}
        {selectedTrap && (
          <div className="absolute top-20 left-4 w-80 bg-zinc-900/95 backdrop-blur-sm rounded-xl border border-red-800/50 p-4 shadow-xl animate-fade-in">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Target size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Speed Trap</h3>
                  <p className="text-sm text-zinc-400">Historical enforcement zone</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTrap(null)}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
              >
                <X size={18} className="text-zinc-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="bg-zinc-800/50 rounded-lg p-2">
                <p className="text-zinc-400 text-xs">Trap Score</p>
                <p className="text-xl font-bold text-red-500">
                  {selectedTrap.trapScore ? Number(selectedTrap.trapScore).toFixed(0) : 'N/A'}
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-2">
                <p className="text-zinc-400 text-xs">Total Stops</p>
                <p className="text-xl font-bold text-white">
                  {selectedTrap.stopCount ? Number(selectedTrap.stopCount) : 'N/A'}
                </p>
              </div>
              {selectedTrap.avgSpeedOver && (
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <p className="text-zinc-400 text-xs">Avg Speed Over</p>
                  <p className="text-lg font-semibold text-orange-400">
                    +{Number(selectedTrap.avgSpeedOver)} mph
                  </p>
                </div>
              )}
              {selectedTrap.primaryMethod && (
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <p className="text-zinc-400 text-xs">Detection</p>
                  <p className="text-lg font-semibold text-white capitalize">
                    {String(selectedTrap.primaryMethod)}
                  </p>
                </div>
              )}
            </div>

            {selectedTrap.location && (
              <div className="text-sm text-zinc-400 mb-3">
                <span className="text-zinc-500">Location:</span>{' '}
                <span className="text-zinc-300">{String(selectedTrap.location)}</span>
              </div>
            )}

            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <AlertTriangle size={12} className="text-red-500" />
              High enforcement area - drive carefully
            </div>
          </div>
        )}

        {/* Report modal */}
        {showReportModal && (
          <ReportModal onClose={() => setShowReportModal(false)} />
        )}
      </MapProvider>
    </div>
  );
}

function ReportModal({ onClose }: { onClose: () => void }) {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const { location } = useGeolocation();

  const reportTypes = [
    { id: 'STATIONARY', label: 'Parked Police', icon: '🚔' },
    { id: 'MOBILE', label: 'Patrol Car', icon: '🚓' },
    { id: 'SPEED_TRAP', label: 'Speed Trap', icon: '📸' },
    { id: 'CHECKPOINT', label: 'Checkpoint', icon: '🚧' },
    { id: 'ACCIDENT', label: 'Accident', icon: '⚠️' },
  ];

  const handleSubmit = () => {
    if (!reportType || !location) return;
    
    // TODO: Submit report via API
    console.log('Report:', { reportType, description, location });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Report Alert</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {reportTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                reportType === type.id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <div className="text-2xl mb-1">{type.icon}</div>
              <div className="text-sm text-white">{type.label}</div>
            </button>
          ))}
        </div>

        <textarea
          placeholder="Add details (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 resize-none h-20 mb-4"
        />

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            className="flex-1" 
            onClick={handleSubmit}
            disabled={!reportType || !location}
          >
            Submit Report
          </Button>
        </div>
      </div>
    </div>
  );
}
