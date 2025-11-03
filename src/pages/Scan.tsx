import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Printer, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { submitPrintJob, createPrintJob, createGroupIdPrintJob } from '@/lib/printnode';
import { Shipment } from '@/types';

export default function Scan() {
  const [uid, setUid] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printerId, setPrinterId] = useState<string>('');
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const [isLastInGroup, setIsLastInGroup] = useState(false);
  const [totalGroupItems, setTotalGroupItems] = useState(0);
  const [groupItems, setGroupItems] = useState<Shipment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    findShipmentByUid, 
    updateShipment, 
    settings,
    addRecentScan,
    setShipments,
    updateSettings
  } = useAppStore();

  // Load shipments and API key from database on mount
  useEffect(() => {
    loadShipments();
    loadAppConfig();
    loadUserSettings();
  }, []);

  const loadAppConfig = async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'printnode_api_key')
      .maybeSingle();

    if (error) {
      console.error('Failed to load app config:', error);
      return;
    }

    if (data?.value) {
      setPrintnodeApiKey(data.value);
    }
  };

  const handleLocationIdChange = async (shipmentId: string, newLocationId: string) => {
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ location_id: newLocationId })
        .eq('id', shipmentId);

      if (error) throw error;

      updateShipment(shipmentId, { location_id: newLocationId });
      
      // Update the groupItems array if the item is in it
      setGroupItems(prev => prev.map(item => 
        item.id === shipmentId ? { ...item, location_id: newLocationId } : item
      ));
      
      toast.success('Location ID updated');
    } catch (error: any) {
      toast.error('Failed to update location ID', { description: error.message });
    }
  };

  const loadUserSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load user settings:', error);
      return;
    }

    if (data) {
      updateSettings({
        default_printer_id: data.default_printer_id,
        auto_print: data.auto_print,
        block_cancelled: data.block_cancelled
      });
      
      // Set printer ID from settings
      if (data.default_printer_id) {
        const savedPrinterId = getCookie('selected_printer_id');
        setPrinterId(savedPrinterId || data.default_printer_id);
      }
    }
  };

  const loadShipments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[Scan] No user found');
      return;
    }

    console.log('[Scan] Loading all shipments with pagination...');
    
    // Fetch all shipments with pagination (1000 rows at a time)
    let allShipments: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (shipmentsError) {
        console.error('[Scan] Failed to load shipments:', shipmentsError);
        return;
      }

      if (shipmentsData && shipmentsData.length > 0) {
        allShipments = [...allShipments, ...shipmentsData];
        hasMore = shipmentsData.length === pageSize;
        page++;
        console.log('[Scan] Loaded page', page, '- Total so far:', allShipments.length);
      } else {
        hasMore = false;
      }
    }

    console.log('[Scan] Finished loading. Total shipments:', allShipments.length);
    console.log('[Scan] Sample UIDs:', allShipments.slice(0, 10).map(s => s.uid));
    console.log('[Scan] Does AKV9L exist in data?', allShipments.some(s => s.uid === 'AKV9L'));
    setShipments(allShipments);
  };

  // Load printer ID from cookie on mount
  useEffect(() => {
    const savedPrinterId = getCookie('selected_printer_id');
    if (savedPrinterId) {
      setPrinterId(savedPrinterId);
    } else if (settings.default_printer_id) {
      setPrinterId(settings.default_printer_id);
    }
  }, [settings.default_printer_id]);

  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  const setCookie = (name: string, value: string, days: number = 365) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  };

  const handlePrinterIdChange = (value: string) => {
    setPrinterId(value);
    if (value) {
      setCookie('selected_printer_id', value);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedShipment]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUid = uid.trim().toUpperCase();
    
    if (!trimmedUid) return;

    const shipment = findShipmentByUid(trimmedUid);

    if (!shipment) {
      toast.error('UID not found', {
        description: `No shipment found for UID: ${trimmedUid}`
      });
      addRecentScan(trimmedUid, 'not_found');
      setSelectedShipment(null);
      setUid('');
      return;
    }

    if (shipment.printed) {
      toast.error('Already printed', {
        description: `This label was already printed${shipment.printed_at ? ` on ${new Date(shipment.printed_at).toLocaleString()}` : ''}`
      });
      addRecentScan(trimmedUid, 'already_printed');
      setUid('');
      return;
    }

    if (settings.block_cancelled && shipment.cancelled && shipment.cancelled.toLowerCase() !== 'false') {
      toast.error('Order cancelled', {
        description: 'This order has been cancelled or failed'
      });
      addRecentScan(trimmedUid, 'cancelled');
      setUid('');
      return;
    }

    if (!shipment.manifest_url) {
      toast.error('Missing manifest URL', {
        description: 'This shipment does not have a manifest URL'
      });
      addRecentScan(trimmedUid, 'missing_manifest');
      setSelectedShipment(shipment);
      setUid('');
      return;
    }

    // Check if this is the last item in a bundle group
    let lastInGroup = false;
    let groupTotal = 0;
    let allGroupItems: Shipment[] = [];
    if (shipment.bundle && shipment.order_group_id) {
      const { data: groupShipments } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_group_id', shipment.order_group_id)
        .order('uid');
      
      allGroupItems = groupShipments || [];
      groupTotal = allGroupItems.length;
      const unprintedCount = allGroupItems.filter(s => !s.printed).length;
      lastInGroup = unprintedCount === 1;
    }

    setSelectedShipment(shipment);
    setIsLastInGroup(lastInGroup);
    setTotalGroupItems(groupTotal);
    setGroupItems(allGroupItems);
    addRecentScan(trimmedUid, 'found');
    setUid('');

    if (settings.auto_print) {
      await handlePrint(shipment);
    }
  };

  const handlePrint = async (shipment: Shipment) => {
    // For bundle items, check if this is the last item in the group
    if (shipment.bundle) {
      if (!shipment.order_group_id) {
        toast.error('Cannot print: Missing group ID');
        return;
      }
      
      // Query all shipments in the same group
      const { data: groupShipments, error } = await supabase
        .from('shipments')
        .select('id, printed')
        .eq('order_group_id', shipment.order_group_id);

      if (error) {
        console.error('Failed to check group status:', error);
        toast.error('Failed to check group status');
        return;
      }

      // Count unprinted items (including this one)
      const unprintedCount = groupShipments?.filter(s => !s.printed).length || 0;

      // If this is the last unprinted item, print manifest instead
      if (unprintedCount === 1) {
        toast.info('Last item in group - printing manifest');
        // Fall through to manifest printing logic below
      } else {
        // Not the last item, print group ID
        if (shipment.group_id_printed) {
          toast.error('Group ID already printed', {
            description: `This bundle's group ID was already printed${shipment.group_id_printed_at ? ` on ${new Date(shipment.group_id_printed_at).toLocaleString()}` : ''}`
          });
          return;
        }
        
        return handlePrintGroupId(shipment);
      }
    }

    // Regular manifest printing for non-bundle items
    if (!shipment.manifest_url) {
      toast.error('Cannot print: Missing manifest URL');
      return;
    }

    if (!printnodeApiKey) {
      toast.error('PrintNode not configured', {
        description: 'Please configure PrintNode API key in Settings'
      });
      return;
    }

    if (!printerId) {
      toast.error('No printer selected', {
        description: 'Please enter a printer ID'
      });
      return;
    }

    setPrinting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const printJob = createPrintJob(
        parseInt(printerId),
        shipment.uid,
        shipment.manifest_url
      );

      const jobId = await submitPrintJob(printnodeApiKey, printJob);

      // Update shipment as printed
      await supabase
        .from('shipments')
        .update({ 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        })
        .eq('id', shipment.id);

      // Log print job
      await supabase
        .from('print_jobs')
        .insert({
          user_id: user.id,
          shipment_id: shipment.id,
          uid: shipment.uid,
          order_id: shipment.order_id,
          printer_id: printerId,
          printnode_job_id: jobId,
          label_url: shipment.manifest_url,
          status: 'queued'
        });

      updateShipment(shipment.id, { 
        printed: true, 
        printed_at: new Date().toISOString(),
        printed_by_user_id: user.id
      });
      
      toast.success('Label printed!', {
        description: `Printed label for ${shipment.uid}`
      });

      setSelectedShipment(null);
    } catch (error: any) {
      toast.error('Print failed', {
        description: error.message
      });

      // Log failed print job
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('print_jobs')
          .insert({
            user_id: user.id,
            shipment_id: shipment.id,
            uid: shipment.uid,
            order_id: shipment.order_id,
            printer_id: printerId || '',
            label_url: shipment.manifest_url,
            status: 'error',
            error: error.message
          });
      }
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintAllGroupManifests = async () => {
    if (!selectedShipment?.order_group_id) {
      toast.error('Cannot print: Missing group ID');
      return;
    }

    if (!selectedShipment.manifest_url) {
      toast.error('Cannot print: Missing manifest URL');
      return;
    }

    if (!printnodeApiKey) {
      toast.error('PrintNode not configured', {
        description: 'Please configure PrintNode API key in Settings'
      });
      return;
    }

    if (!printerId) {
      toast.error('No printer selected', {
        description: 'Please enter a printer ID'
      });
      return;
    }

    setPrinting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      // Print the manifest
      const printJob = createPrintJob(
        parseInt(printerId),
        selectedShipment.uid,
        selectedShipment.manifest_url
      );

      const jobId = await submitPrintJob(printnodeApiKey, printJob);

      // Mark all items in the group as printed
      await supabase
        .from('shipments')
        .update({ 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        })
        .eq('order_group_id', selectedShipment.order_group_id);

      // Log print job for the manifest
      await supabase
        .from('print_jobs')
        .insert({
          user_id: user.id,
          shipment_id: selectedShipment.id,
          uid: selectedShipment.uid,
          order_id: selectedShipment.order_id,
          printer_id: printerId,
          printnode_job_id: jobId,
          label_url: selectedShipment.manifest_url,
          status: 'queued'
        });

      // Update local state for all group items
      groupItems.forEach(item => {
        updateShipment(item.id, { 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        });
      });

      toast.success('All items marked as printed!', {
        description: `Printed manifest for group`
      });

      // Reload the group items
      await loadShipments();
      setSelectedShipment(null);
      setGroupItems([]);
    } catch (error: any) {
      toast.error('Print failed', {
        description: error.message
      });
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintGroupId = async (shipment: Shipment) => {
    if (!shipment.order_group_id) {
      toast.error('Cannot print: Missing group ID');
      return;
    }

    // Require location_id for group ID labels
    if (!shipment.location_id || shipment.location_id.trim() === '') {
      toast.error('Cannot print: Location ID required', {
        description: 'Please enter a location ID before printing group labels'
      });
      return;
    }

    if (!printnodeApiKey) {
      toast.error('PrintNode not configured', {
        description: 'Please configure PrintNode API key in Settings'
      });
      return;
    }

    if (!printerId) {
      toast.error('No printer selected', {
        description: 'Please enter a printer ID'
      });
      return;
    }

    setPrinting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const printJob = createGroupIdPrintJob(
        parseInt(printerId),
        shipment.order_group_id,
        shipment.uid,
        shipment.location_id
      );

      const jobId = await submitPrintJob(printnodeApiKey, printJob);

      // Update shipment with group ID printed status and mark as printed
      await supabase
        .from('shipments')
        .update({ 
          group_id_printed: true, 
          group_id_printed_at: new Date().toISOString(),
          group_id_printed_by_user_id: user.id,
          printed: true,
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        })
        .eq('id', shipment.id);

      // Log print job
      await supabase
        .from('print_jobs')
        .insert({
          user_id: user.id,
          shipment_id: shipment.id,
          uid: shipment.uid,
          order_id: shipment.order_id,
          printer_id: printerId,
          printnode_job_id: jobId,
          label_url: `group_id_${shipment.order_group_id}`,
          status: 'queued'
        });

      updateShipment(shipment.id, { 
        group_id_printed: true, 
        group_id_printed_at: new Date().toISOString(),
        group_id_printed_by_user_id: user.id,
        printed: true,
        printed_at: new Date().toISOString(),
        printed_by_user_id: user.id
      });
      
      toast.success('Group ID label printed!', {
        description: `Printed group ID for bundle ${shipment.uid}`
      });

      setSelectedShipment(null);
    } catch (error: any) {
      toast.error('Print failed', {
        description: error.message
      });

      // Log failed print job
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('print_jobs')
          .insert({
            user_id: user.id,
            shipment_id: shipment.id,
            uid: shipment.uid,
            order_id: shipment.order_id,
            printer_id: printerId || '',
            label_url: `group_id_${shipment.order_group_id}`,
            status: 'error',
            error: error.message
          });
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Scan Label</h1>
        <p className="text-muted-foreground">Scan barcode with handheld scanner</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleScan} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">PrintNode Printer ID</label>
                <Input
                  type="number"
                  value={printerId}
                  onChange={(e) => handlePrinterIdChange(e.target.value)}
                  placeholder="Enter printer ID..."
                  className="h-12"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">UID</label>
                <Input
                  ref={inputRef}
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Scan or enter UID..."
                  className="text-2xl h-16 text-center font-mono"
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-lg">
              Lookup
            </Button>
          </form>
        </CardContent>
      </Card>

      {selectedShipment && (
        <Card className={selectedShipment.bundle ? "border-4 border-primary bg-primary/10" : "border-2 border-primary"}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Shipment Found</span>
                {selectedShipment.bundle && (
                  <>
                    <Badge variant="secondary" className="text-sm">
                      Bundle Item
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {totalGroupItems} items in group
                    </Badge>
                    {isLastInGroup && (
                      <Badge className="bg-warning text-warning-foreground text-sm">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Last in Group
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {selectedShipment.manifest_url ? (
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Manifest Ready
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-4 w-4 mr-1" />
                  Missing Manifest URL
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-lg">
              <div>
                <p className="text-muted-foreground">UID</p>
                <p className="font-mono font-bold">{selectedShipment.uid}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Order ID</p>
                <p className="font-mono">{selectedShipment.order_id}</p>
              </div>
              {selectedShipment.order_group_id && (
                <div>
                  <p className="text-muted-foreground">Group ID</p>
                  <p className="font-mono text-xs" title={selectedShipment.order_group_id}>
                    {selectedShipment.order_group_id.slice(0, 12)}...
                  </p>
                </div>
              )}
              {selectedShipment.bundle && (
                <div>
                  <p className="text-muted-foreground">Location ID {!selectedShipment.location_id && <span className="text-destructive">*</span>}</p>
                  <Input
                    value={selectedShipment.location_id || ''}
                    onChange={(e) => {
                      handleLocationIdChange(selectedShipment.id, e.target.value);
                      setSelectedShipment({ ...selectedShipment, location_id: e.target.value });
                    }}
                    placeholder="Enter location..."
                    className="h-9 mt-1"
                  />
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Buyer</p>
                <p className="font-semibold">{selectedShipment.buyer}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Product</p>
                <p>{selectedShipment.product_name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Shipping Address</p>
                <p>{selectedShipment.address_full}</p>
              </div>
              {selectedShipment.tracking && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Tracking</p>
                  <p className="font-mono">{selectedShipment.tracking}</p>
                </div>
              )}
            </div>

            {(selectedShipment.manifest_url || selectedShipment.bundle) && (
              <Button
                onClick={() => handlePrint(selectedShipment)}
                disabled={
                  printing || 
                  (selectedShipment.bundle && selectedShipment.group_id_printed && !isLastInGroup) ||
                  (selectedShipment.bundle && !isLastInGroup && (!selectedShipment.location_id || selectedShipment.location_id.trim() === ''))
                }
                size="lg"
                className="w-full"
              >
                <Printer className="h-5 w-5 mr-2" />
                {printing ? 'Printing...' : (selectedShipment.bundle && !isLastInGroup) ? 'Print Group ID Label' : 'Print Label'}
              </Button>
            )}
            
            {selectedShipment.bundle && !isLastInGroup && (!selectedShipment.location_id || selectedShipment.location_id.trim() === '') && (
              <p className="text-sm text-destructive text-center">
                Location ID is required to print group labels
              </p>
            )}
            
            {selectedShipment.bundle && selectedShipment.group_id_printed && (
              <div className="text-sm text-muted-foreground text-center">
                Group ID printed on {new Date(selectedShipment.group_id_printed_at!).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedShipment?.bundle && groupItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Group Items ({groupItems.length})</CardTitle>
              <Button
                onClick={handlePrintAllGroupManifests}
                disabled={printing || groupItems.every(item => item.printed)}
                variant="default"
              >
                <Printer className="h-4 w-4 mr-2" />
                Mark All Printed & Print Manifest
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID</TableHead>
                    <TableHead>Location ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead className="text-center">Manifest</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupItems.map((item) => {
                    const unprintedInGroup = groupItems.filter(s => !s.printed).length;
                    const isItemLastInGroup = unprintedInGroup === 1 && !item.printed;
                    
                    return (
                      <TableRow 
                        key={item.id}
                        className={
                          item.id === selectedShipment.id 
                            ? "bg-primary/20 font-semibold" 
                            : item.printed 
                              ? "bg-success/10" 
                              : ""
                        }
                      >
                        <TableCell className="font-mono text-xs">{item.uid}</TableCell>
                        <TableCell>
                          <Input
                            value={item.location_id || ''}
                            onChange={(e) => handleLocationIdChange(item.id, e.target.value)}
                            placeholder="Location"
                            className="w-24 h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.buyer}</TableCell>
                        <TableCell className="max-w-[250px] truncate" title={item.address_full}>
                          {item.address_full}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.tracking || '-'}</TableCell>
                        <TableCell className="text-center">
                          {item.manifest_url ? (
                            <Badge variant="outline" className="bg-success/10">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-destructive/10">
                              <XCircle className="h-3 w-3 mr-1" />
                              Missing
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.printed ? (
                            <Badge className="bg-success text-success-foreground">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Printed
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {!item.printed && (item.manifest_url || item.bundle) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrint(item)}
                              disabled={
                                printing || 
                                (item.group_id_printed && !isItemLastInGroup) ||
                                (!isItemLastInGroup && item.bundle && (!item.location_id || item.location_id.trim() === ''))
                              }
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              {isItemLastInGroup ? 'Manifest' : item.group_id_printed ? 'Printed' : 'Group ID'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
