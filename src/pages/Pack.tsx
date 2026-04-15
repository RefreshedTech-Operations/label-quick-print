import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package2, ScanLine, Camera, Keyboard, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useIsMobile } from '@/hooks/use-mobile';

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

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
  const inputRef = useRef<HTMLInputElement>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);
  const lastTrackingRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

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
    if (cameraMode || showStationPicker || isMobile) return;
    const interval = setInterval(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [cameraMode, showStationPicker, isMobile]);

  useEffect(() => {
    if (!showStationPicker) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [showStationPicker]);

  const loadUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

  const processTracking = useCallback(async (rawInput: string): Promise<'success' | 'error'> => {
    if (!rawInput.trim()) return 'error';

    const stationId = localStorage.getItem('pack-station-id') || '';
    if (!stationId) {
      toast.error('Select a station first');
      flashStatus('error');
      return 'error';
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
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
        packed_by_user_id: user.id,
        pack_station_id: stationId,
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
  }, []);

  useEffect(() => {
    if (!cameraMode) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
      return;
    }

    const scanner = new Html5Qrcode('pack-camera-reader', {
      formatsToSupport: SUPPORTED_FORMATS,
      verbose: false,
    });
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 300, height: 100 },
        aspectRatio: 1.333,
      },
      decodedText => {
        const trackingCandidate = stripPrefix(decodedText).toUpperCase();
        if (!isLikelyTrackingBarcode(trackingCandidate)) return;
        if (cooldownRef.current || trackingCandidate === lastTrackingRef.current) return;

        lastTrackingRef.current = trackingCandidate;
        cooldownRef.current = true;
        setCooldownActive(true);
        setLastScannedTracking(trackingCandidate);

        processTracking(trackingCandidate);

        if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = setTimeout(() => {
          cooldownRef.current = false;
          lastTrackingRef.current = null;
          setCooldownActive(false);
          setLastScannedTracking(null);
        }, 5000);
      },
      () => {}
    ).catch(err => {
      console.error('Camera start failed:', err);
      toast.error('Camera access denied');
      setCameraMode(false);
    });

    return () => {
      scanner.stop().catch(() => {});
      scanner.clear();
      scannerRef.current = null;
    };
  }, [cameraMode, processTracking]);

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    const captured = scanInput;
    setScanInput('');
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Pack</h1>
        </div>

        <button
          onClick={() => {
            inputRef.current?.blur();
            setShowStationPicker(true);
          }}
          className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm text-secondary-foreground"
        >
          <span className="max-w-[8rem] truncate">{stationName || 'Select Station'}</span>
          <ChevronDown className="h-3 w-3" />
        </button>

        <Sheet open={showStationPicker} onOpenChange={setShowStationPicker}>
          <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto rounded-t-xl px-4 pb-10 pt-4">
            <SheetHeader className="mb-3">
              <SheetTitle>Select Pack Station</SheetTitle>
            </SheetHeader>
            <div className="space-y-1.5">
              {stations.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStation(s.id);
                    setShowStationPicker(false);
                  }}
                  className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                    selectedStation === s.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent'
                  }`}
                >
                  {s.name}
                </button>
              ))}
              {stations.length === 0 && (
                <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-muted-foreground">
                  No active stations available.
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ScanLine className="h-4 w-4" />
            Scan Tracking
          </span>
          <Button
            variant={cameraMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setCameraMode(!cameraMode)}
            className="h-8 gap-1.5"
          >
            {cameraMode ? <Keyboard className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {cameraMode ? 'Type' : 'Camera'}
          </Button>
        </div>
        {cameraMode ? (
          <div className="relative overflow-hidden rounded-lg border border-border bg-black">
            <div id="pack-camera-reader" className="w-full" />
            {cooldownActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-green-500/20">
                <span className="text-lg font-bold text-green-400">✓ Scanned</span>
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
              autoFocus={!isMobile}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="h-14 text-lg font-mono"
            />
          </form>
        )}
      </div>

      {recentPacks.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
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
                  <span className="truncate text-sm font-medium">{pack.buyer}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(pack.packed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{pack.product_name}</span>
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
