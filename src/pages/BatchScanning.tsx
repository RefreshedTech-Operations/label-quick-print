import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Package, ScanBarcode, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Batch, BatchPackage } from '@/types/batch';

export default function BatchScanning() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [batchName, setBatchName] = useState('');
  const [showDate, setShowDate] = useState<Date | undefined>(undefined);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [scannedPackages, setScannedPackages] = useState<BatchPackage[]>([]);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentBatch) {
      loadScannedPackages();
      // Auto-focus the input after loading packages
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentBatch]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to access batch scanning');
      return;
    }
    setUser(user);
    setLoading(false);
  };

  const loadScannedPackages = async () => {
    if (!currentBatch) return;

    const { data, error } = await supabase
      .from('shipments')
      .select('id, tracking, order_id, buyer, product_name, printed, batch_scanned_at')
      .eq('batch_id', currentBatch.id)
      .order('batch_scanned_at', { ascending: false });

    if (error) {
      console.error('Error loading packages:', error);
      return;
    }

    setScannedPackages(data || []);
  };

  const createBatch = async () => {
    if (!batchName.trim()) {
      toast.error('Please enter a batch name');
      return;
    }

    const { data, error } = await supabase
      .from('batches')
      .insert({
        name: batchName,
        show_date: showDate ? format(showDate, 'yyyy-MM-dd') : null,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create batch');
      console.error(error);
      return;
    }

    setCurrentBatch(data as Batch);
    setBatchName('');
    setShowDate(undefined);
    toast.success(`Batch "${data.name}" created`);
    
    // Auto-focus the tracking input
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const scanPackage = async () => {
    if (!trackingNumber.trim() || !currentBatch) return;

    setScanning(true);

    try {
      // Search for shipment by tracking number (case-insensitive)
      const { data: shipments, error: searchError } = await supabase
        .from('shipments')
        .select('*')
        .ilike('tracking', trackingNumber.trim())
        .limit(1);

      if (searchError) throw searchError;

      if (!shipments || shipments.length === 0) {
        toast.error('Tracking number not found');
        setTrackingNumber('');
        inputRef.current?.focus();
        return;
      }

      const shipment = shipments[0];

      // Check if already in this batch
      if (shipment.batch_id === currentBatch.id) {
        toast.error('Package already scanned in this batch');
        setTrackingNumber('');
        inputRef.current?.focus();
        return;
      }

      // Check if in another batch
      if (shipment.batch_id) {
        toast.error('Package is already in another batch');
        setTrackingNumber('');
        inputRef.current?.focus();
        return;
      }

      // Check show date filter
      if (currentBatch.show_date && shipment.show_date !== currentBatch.show_date) {
        toast.error(`Package show date doesn't match batch filter`);
        setTrackingNumber('');
        inputRef.current?.focus();
        return;
      }

      // Add to batch
      const { error: updateError } = await supabase
        .from('shipments')
        .update({
          batch_id: currentBatch.id,
          batch_scanned_at: new Date().toISOString(),
          batch_scanned_by_user_id: user.id,
        })
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Increment batch count
      const { error: incrementError } = await supabase.rpc('increment_batch_count', {
        batch_uuid: currentBatch.id,
      });

      if (incrementError) throw incrementError;

      // Update current batch package count
      setCurrentBatch({
        ...currentBatch,
        package_count: currentBatch.package_count + 1,
      });

      // Reload scanned packages
      await loadScannedPackages();

      toast.success(`Scanned: ${shipment.tracking}`);
      setTrackingNumber('');
      
      // Auto-focus for next scan
      inputRef.current?.focus();
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan package');
    } finally {
      setScanning(false);
    }
  };

  const completeBatch = async () => {
    if (!currentBatch) return;

    const { error } = await supabase
      .from('batches')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
      })
      .eq('id', currentBatch.id);

    if (error) {
      toast.error('Failed to complete batch');
      console.error(error);
      return;
    }

    toast.success(`Batch "${currentBatch.name}" completed with ${currentBatch.package_count} packages`);
    setCurrentBatch(null);
    setScannedPackages([]);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Batch Scanning</h1>
        <p className="text-muted-foreground">Scan packages into batches for organized shipping</p>
      </div>

      {!currentBatch ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Create New Batch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batchName">Batch Name *</Label>
              <Input
                id="batchName"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g., Monday Morning Shipment"
                onKeyDown={(e) => e.key === 'Enter' && createBatch()}
              />
            </div>

            <div className="space-y-2">
              <Label>Show Date Filter (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !showDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {showDate ? format(showDate, 'PPP') : 'All show dates'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={showDate}
                    onSelect={setShowDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {showDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDate(undefined)}
                  className="w-full"
                >
                  Clear filter
                </Button>
              )}
            </div>

            <Button onClick={createBatch} className="w-full h-14 text-lg">
              <Package className="mr-2 h-5 w-5" />
              Create Batch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ScanBarcode className="h-5 w-5" />
                  {currentBatch.name}
                </span>
                <span className="text-2xl font-bold text-primary">
                  {currentBatch.package_count}
                </span>
              </CardTitle>
              {currentBatch.show_date && (
                <p className="text-sm text-muted-foreground">
                  Show Date: {format(new Date(currentBatch.show_date), 'PPP')}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tracking">Scan Tracking Number</Label>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    id="tracking"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && scanPackage()}
                    placeholder="Scan or type tracking number"
                    disabled={scanning}
                    className="text-lg h-14"
                    autoFocus
                  />
                  <Button
                    onClick={scanPackage}
                    disabled={!trackingNumber.trim() || scanning}
                    className="h-14 px-8"
                  >
                    <ScanBarcode className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <Button
                onClick={completeBatch}
                variant="default"
                className="w-full h-14 text-lg"
                disabled={currentBatch.package_count === 0}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Complete Batch ({currentBatch.package_count} packages)
              </Button>
            </CardContent>
          </Card>

          {scannedPackages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recently Scanned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {scannedPackages.slice(0, 10).map((pkg) => (
                    <div
                      key={pkg.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{pkg.tracking}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {pkg.buyer} - {pkg.product_name}
                        </p>
                      </div>
                      {pkg.printed && (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
