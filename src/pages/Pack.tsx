import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package2, ScanLine, Camera, Keyboard, ChevronDown } from 'lucide-react';
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        loadStations();
        loadUser();
      }
    });
    return () => subscription.unsubscribe();
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

  const normalizeTracking = (input: string): string => {
    // Strip control chars, whitespace, and GS1/AIM symbology prefixes
    let cleaned = input.replace(/[\r\n\t\x00-\x1f\s]/g, '').replace(/^\]C1/, '');
    // UPS: keep as-is
    if (cleaned.startsWith('1Z')) return cleaned.toUpperCase();
    // USPS GS1-128: starts with 420 + ZIP, extract trailing 22-digit tracking
    if (/^420\d/.test(cleaned) && cleaned.length > 22) {
      return cleaned.slice(-22);
    }
    // Generic long barcode fallback
    if (cleaned.length > 22) {
      return cleaned.substring(15);
    }
    return cleaned.toUpperCase();
  };

  const isLikelyTrackingBarcode = (input: string): boolean => {
    const cleaned = normalizeTracking(input);
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

    const tracking = normalizeTracking(rawInput);
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
      const prev = scannerRef.current;
      if (prev) {
        scannerRef.current = null;
        const state = prev.getState?.();
        if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
          prev.stop().then(() => prev.clear()).catch(() => {});
        } else {
          try { prev.clear(); } catch {}
        }
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
      ({
        fps: 15,
        qrbox: { width: 600, height: 150 },
        aspectRatio: 1.333,
        useBarCodeDetectorIfSupported: false,
      }) as any,
      decodedText => {
        const trackingCandidate = normalizeTracking(decodedText);
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
      scannerRef.current = null;
      const state = scanner.getState?.();
      if (state === 2 || state === 3) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      } else {
        try { scanner.clear(); } catch {}
      }
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
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Pack</h1>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            onClick={() => {
              inputRef.current?.blur();
              setShowStationPicker(prev => !prev);
            }}
            className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm text-secondary-foreground"
          >
            <span className="max-w-[8rem] truncate">{stationName || 'Select Station'}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showStationPicker ? 'rotate-180' : ''}`} />
          </button>

          {showStationPicker && (
            <div className="w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-2 shadow-lg">
              <div className="px-2 pb-2 pt-1 text-sm font-semibold text-foreground">Select Pack Station</div>
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
            </div>
          )}
        </div>
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
            {/* Alignment overlay: guides user to position the long tracking barcode horizontally */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative w-[88%] h-[28%] max-h-40">
                {/* Corner brackets */}
                <div className="absolute -top-0.5 -left-0.5 h-6 w-6 border-t-2 border-l-2 border-primary rounded-tl" />
                <div className="absolute -top-0.5 -right-0.5 h-6 w-6 border-t-2 border-r-2 border-primary rounded-tr" />
                <div className="absolute -bottom-0.5 -left-0.5 h-6 w-6 border-b-2 border-l-2 border-primary rounded-bl" />
                <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 border-b-2 border-r-2 border-primary rounded-br" />
                {/* Center scan line */}
                <div className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 bg-primary/70 shadow-[0_0_8px_hsl(var(--primary))]" />
              </div>
              <span className="mt-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                Align barcode horizontally inside the box
              </span>
            </div>
            {cooldownActive && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/30">
                <span className="text-lg font-bold text-primary-foreground">✓ Scanned</span>
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
