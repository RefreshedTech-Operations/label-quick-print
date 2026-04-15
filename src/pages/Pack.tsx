import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package2, ScanLine, Camera, Keyboard, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useZxing } from 'react-zxing';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

// Module-level constant — stable reference prevents useZxing reinitialization
const BARCODE_HINTS = new Map();
BARCODE_HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
]);
BARCODE_HINTS.set(DecodeHintType.TRY_HARDER, true);

interface PackStation {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

interface RecentPack {
  tracking: string;
  buyer: string;
  product_name: string;
  order_id: string;
  packed_at: string;
}

export default function Pack() {
  const [stations, setStations] = useState<PackStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>(() => {
    return localStorage.getItem('pack-station-id') || '';
  });
  const [scanInput, setScanInput] = useState('');
  const [recentPacks, setRecentPacks] = useState<RecentPack[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [cooldownActive, setCooldownActive] = useState(false);
  const [lastScannedTracking, setLastScannedTracking] = useState<string | null>(null);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadStations();
    loadUser();
  }, []);

  useEffect(() => {
    if (selectedStation) {
      localStorage.setItem('pack-station-id', selectedStation);
      setShowStationPicker(false);
    }
  }, [selectedStation]);

  useEffect(() => {
    if (cameraMode) return;
    const interval = setInterval(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [cameraMode]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadStations = async () => {
    const { data } = await supabase
      .from('pack_stations')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setStations(data || []);
  };

  const stripPrefix = (input: string): string => {
    // Remove all control characters and whitespace (scanner artifacts)
    const cleaned = input.replace(/[\r\n\t\x00-\x1f\s]/g, '');
    if (cleaned.startsWith('1Z')) return cleaned;
    if (cleaned.length > 30) {
      return cleaned.substring(15);
    }
    return cleaned;
  };

  const isLikelyTrackingBarcode = (input: string): boolean => {
    const cleaned = stripPrefix(input).toUpperCase();

    return (
      /^1Z[0-9A-Z]{16}$/.test(cleaned) ||
      /^[0-9]{12,35}$/.test(cleaned) ||
      /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(cleaned)
    );
  };

  const flashStatus = (status: 'success' | 'error') => {
    setScanStatus(status);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => setScanStatus('idle'), 2000);
  };

  const processTracking = async (rawInput: string): Promise<'success' | 'error'> => {
    if (!rawInput.trim()) return 'error';

    if (!selectedStation) {
      toast.error('Select a station first');
      flashStatus('error');
      return 'error';
    }

    if (!userId) {
      toast.error('Not authenticated');
      flashStatus('error');
      return 'error';
    }

    const tracking = stripPrefix(rawInput).toUpperCase();

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const { data: shipments, error } = await supabase
      .from('shipments')
      .select('id, tracking, buyer, product_name, order_id, packed, packed_at, packed_by_user_id')
      .eq('tracking', tracking)
      .gte('created_at', fiveDaysAgo)
      .limit(1);

    if (error) {
      toast.error('Lookup failed', { description: error.message });
      flashStatus('error');
      return 'error';
    }

    if (!shipments || shipments.length === 0) {
      toast.error('Not found', { description: tracking });
      flashStatus('error');
      return 'error';
    }

    const shipment = shipments[0];

    if (shipment.packed) {
      let packedByEmail = 'unknown';
      if (shipment.packed_by_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', shipment.packed_by_user_id)
          .single();
        if (profile) packedByEmail = profile.email || 'unknown';
      }
      toast.warning('Already packed', {
        description: `By ${packedByEmail} at ${shipment.packed_at ? new Date(shipment.packed_at).toLocaleString() : '?'}`,
      });
      flashStatus('error');
      return 'error';
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        packed: true,
        packed_at: now,
        packed_by_user_id: userId,
        pack_station_id: selectedStation,
      })
      .eq('id', shipment.id);

    if (updateError) {
      toast.error('Update failed', { description: updateError.message });
      flashStatus('error');
      return 'error';
    }

    toast.success('Packed!', {
      description: `${shipment.buyer} — ${shipment.product_name}`,
    });

    flashStatus('success');

    setRecentPacks(prev => [{
      tracking: shipment.tracking || tracking,
      buyer: shipment.buyer || '',
      product_name: shipment.product_name || '',
      order_id: shipment.order_id,
      packed_at: now,
    }, ...prev]);

    return 'success';
  };

  const { ref: cameraRef } = useZxing({
    paused: !cameraMode || cooldownActive,
    hints: BARCODE_HINTS,
    timeBetweenDecodingAttempts: 150,
    constraints: {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    },
    onDecodeResult(result) {
      const text = result.getText().trim();
      const trackingCandidate = stripPrefix(text).toUpperCase();

      if (!isLikelyTrackingBarcode(trackingCandidate)) return;
      if (cooldownActive || trackingCandidate === lastScannedTracking) return;

      setLastScannedTracking(trackingCandidate);
      setCooldownActive(true);
      processTracking(trackingCandidate);

      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = setTimeout(() => {
        setCooldownActive(false);
        setLastScannedTracking(null);
      }, 5000);
    },
    onError(err) {
      if (err instanceof DOMException) {
        toast.error('Camera access denied');
        setCameraMode(false);
      }
    },
  });

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    const captured = scanInput;
    setScanInput('');
    // Short debounce to let scanner finish injecting all characters
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      processTracking(captured);
    }, 50);
  };

  const stationName = stations.find(s => s.id === selectedStation)?.name;

  return (
    <div className={`container mx-auto p-3 max-w-lg space-y-3 transition-colors duration-500 min-h-screen ${
      scanStatus === 'success' ? 'bg-green-500/10' :
      scanStatus === 'error' ? 'bg-red-500/10' : ''
    }`}>
      {/* Compact header with inline station */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Pack</h1>
        </div>
        {stationName && !showStationPicker ? (
          <button
            onClick={() => setShowStationPicker(true)}
            className="flex items-center gap-1 text-sm px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground"
          >
            {stationName}
            <ChevronDown className="h-3 w-3" />
          </button>
        ) : (
          <div className="w-40">
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Station..." />
              </SelectTrigger>
              <SelectContent>
                {stations.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Scan input — hero element */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <ScanLine className="h-4 w-4" />
            Scan Tracking
          </span>
          <Button
            variant={cameraMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setCameraMode(!cameraMode)}
            className="gap-1.5 h-8"
          >
            {cameraMode ? <Keyboard className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {cameraMode ? 'Type' : 'Camera'}
          </Button>
        </div>
        {cameraMode ? (
          <div className="rounded-lg overflow-hidden border border-border bg-black relative">
            <video ref={cameraRef} className="w-full aspect-[4/3] object-cover" />
            {/* Targeting reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[70%] h-16 border-2 border-red-500 rounded-md opacity-80" />
            </div>
            {cooldownActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 pointer-events-none">
                <span className="text-green-400 font-bold text-lg">✓ Scanned</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleScan}>
            <Input
              ref={inputRef}
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder="Scan or type tracking..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="text-lg h-14 font-mono"
            />
          </form>
        )}
      </div>

      {/* Recent packs — stacked cards */}
      {recentPacks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Recent</span>
            <Badge variant="outline" className="text-xs">{recentPacks.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {recentPacks.map((pack, i) => (
              <div
                key={i}
                className="rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">{pack.buyer}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(pack.packed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">{pack.product_name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{pack.tracking?.slice(-8)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
