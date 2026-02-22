import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package2, ScanLine, Camera, Keyboard } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useZxing } from 'react-zxing';

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
    }
  }, [selectedStation]);

  // Keep input focused (only in text mode)
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
    const trimmed = input.trim();
    if (trimmed.length > 22) {
      return trimmed.substring(12);
    }
    return trimmed;
  };

  const flashStatus = (status: 'success' | 'error') => {
    setScanStatus(status);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => setScanStatus('idle'), 2000);
  };

  const processTracking = async (rawInput: string): Promise<'success' | 'error'> => {
    if (!rawInput.trim()) return 'error';

    if (!selectedStation) {
      toast.error('Please select a packing station first');
      flashStatus('error');
      return 'error';
    }

    if (!userId) {
      toast.error('Not authenticated');
      flashStatus('error');
      return 'error';
    }

    const tracking = stripPrefix(rawInput);

    // Look up shipment by tracking
    const { data: shipments, error } = await supabase
      .from('shipments')
      .select('id, tracking, buyer, product_name, order_id, packed, packed_at, packed_by_user_id')
      .ilike('tracking', tracking)
      .limit(1);

    if (error) {
      toast.error('Failed to look up order', { description: error.message });
      flashStatus('error');
      return 'error';
    }

    if (!shipments || shipments.length === 0) {
      toast.error('Order not found', { description: `No order found for tracking: ${tracking}` });
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
        description: `Packed by ${packedByEmail} at ${shipment.packed_at ? new Date(shipment.packed_at).toLocaleString() : 'unknown time'}`,
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
      toast.error('Failed to mark as packed', { description: updateError.message });
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
    paused: !cameraMode,
    onDecodeResult(result) {
      const text = result.getText();
      processTracking(text);
    },
    onError(err) {
      // Silence continuous decode errors, only log real issues
      if (err instanceof DOMException) {
        toast.error('Camera access denied');
        setCameraMode(false);
      }
    },
  });

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    setScanInput('');
    await processTracking(scanInput);
  };

  const stationName = stations.find(s => s.id === selectedStation)?.name;

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Package2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Pack</h1>
          <p className="text-muted-foreground">Scan tracking numbers to mark orders as packed</p>
        </div>
      </div>

      {/* Station selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="station">Packing Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger id="station">
                  <SelectValue placeholder="Select station..." />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {stationName && (
              <Badge variant="secondary" className="mt-5 text-sm px-3 py-1">
                {stationName}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scan input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="scan" className="flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              Scan Tracking Number
            </Label>
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCameraMode(!cameraMode)}
                className="gap-1.5"
              >
                {cameraMode ? <Keyboard className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                {cameraMode ? 'Type' : 'Camera'}
              </Button>
            )}
          </div>
          {cameraMode ? (
            <div className="rounded-lg overflow-hidden border border-border bg-black">
              <video ref={cameraRef} className="w-full aspect-[4/3] object-cover" />
            </div>
          ) : (
            <form onSubmit={handleScan}>
              <Input
                ref={inputRef}
                id="scan"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                placeholder="Scan or type tracking number..."
                autoFocus
                autoComplete="off"
                className="text-lg h-12 font-mono"
              />
            </form>
          )}
        </CardContent>
      </Card>

      {/* Recent packs */}
      {recentPacks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Recent Packs
              <Badge variant="outline">{recentPacks.length} this session</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPacks.map((pack, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{pack.tracking}</TableCell>
                    <TableCell>{pack.buyer}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{pack.product_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(pack.packed_at).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
