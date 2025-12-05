import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Printer, CheckCircle, XCircle, AlertCircle, MapPin } from 'lucide-react';
import { submitPrintJob, createPrintJob, createGroupIdPrintJob } from '@/lib/printnode';
import { Shipment } from '@/types';
import { ChargerWarning } from '@/components/ChargerWarning';
import { createPickListPrintJob, PickListData } from '@/lib/pickList';
import { NewBundleLocationDialog } from '@/components/NewBundleLocationDialog';

export default function Scan() {
  const [uid, setUid] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printerId, setPrinterId] = useState<string>('');
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const [isLastInGroup, setIsLastInGroup] = useState(false);
  const [totalGroupItems, setTotalGroupItems] = useState(0);
  const [groupItems, setGroupItems] = useState<Shipment[]>([]);
  const [editingLocationIds, setEditingLocationIds] = useState<{[key: string]: string}>({});
  const [chargersAcknowledged, setChargersAcknowledged] = useState(false);
  const [recommendedLocation, setRecommendedLocation] = useState<string | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationAcknowledged, setLocationAcknowledged] = useState(false);
  const [overrideLocation, setOverrideLocation] = useState(false);
  const [customLocation, setCustomLocation] = useState('');
  const [newBundleDialogOpen, setNewBundleDialogOpen] = useState(false);
  const [suggestedNewLocation, setSuggestedNewLocation] = useState<string | null>(null);
  const [allLocationsOccupied, setAllLocationsOccupied] = useState(false);
  const [pendingShipment, setPendingShipment] = useState<Shipment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  const { 
    settings,
    addRecentScan,
    updateSettings
  } = useAppStore();

  // Load API key and settings on mount
  useEffect(() => {
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
    // Clear editing state
    const { [shipmentId]: _, ...rest } = editingLocationIds;
    setEditingLocationIds(rest);

    try {
      // ALWAYS update only the CURRENT scanned item, never all bundle items
      const { error } = await supabase
        .from('shipments')
        .update({ location_id: newLocationId })
        .eq('id', shipmentId);

      if (error) throw error;
      
      // Update only this single item in local state
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

  const findShipmentByUid = async (uid: string): Promise<Shipment | null> => {
    const upperUid = uid.toUpperCase();
    
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .or(`uid.ilike.${upperUid},uid.ilike.%${upperUid}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Failed to find shipment:', error);
      return null;
    }

    return data;
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

  const isLabelOnlyOrder = (shipment: Shipment) => {
    return shipment.label_url && 
           shipment.manifest_url && 
           shipment.label_url === shipment.manifest_url;
  };

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

  // Charger warning is informational only, no acknowledgment reset needed

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedShipment]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUid = uid.trim().toUpperCase();
    
    if (!trimmedUid) return;

    const shipment = await findShipmentByUid(trimmedUid);

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
      
      // Check for existing location in bundle
      const existingLocation = allGroupItems.find(s => s.location_id)?.location_id || null;
      setRecommendedLocation(existingLocation);
      // If this item already has a location set, consider it acknowledged
      setLocationAcknowledged(!!shipment.location_id);
      setOverrideLocation(false);
      setCustomLocation('');
      
      // First device in NEW bundle - no existing location anywhere
      if (!existingLocation && !shipment.location_id) {
        // Get next available location from database
        const { data: nextLocation, error } = await supabase.rpc('get_next_available_location');
        
        if (error) {
          console.error('Failed to get next available location:', error);
        }
        
        if (nextLocation) {
          setSuggestedNewLocation(nextLocation);
          setAllLocationsOccupied(false);
        } else {
          // All locations occupied
          setSuggestedNewLocation(null);
          setAllLocationsOccupied(true);
        }
        
        // Store pending shipment and show new bundle dialog
        setPendingShipment(shipment);
        setNewBundleDialogOpen(true);
        
        // Set state for display but don't auto-print yet
        setSelectedShipment(shipment);
        setIsLastInGroup(lastInGroup);
        setTotalGroupItems(groupTotal);
        setGroupItems(allGroupItems);
        addRecentScan(trimmedUid, 'found');
        setUid('');
        return; // Wait for location confirmation before continuing
      }
      
      // Auto-show dialog if subsequent device without location
      if (existingLocation && !shipment.location_id) {
        setLocationDialogOpen(true);
      }
    } else {
      // Not a bundle, reset location states
      setRecommendedLocation(null);
      setLocationAcknowledged(false);
    }

    setSelectedShipment(shipment);
    setIsLastInGroup(lastInGroup);
    setTotalGroupItems(groupTotal);
    setGroupItems(allGroupItems);
    addRecentScan(trimmedUid, 'found');
    setUid('');

    // Only auto-print for non-bundles, or bundles that already have locations
    if (settings.auto_print && (!shipment.bundle || shipment.location_id)) {
      await handlePrint(shipment);
    }
  };

  // Handle new bundle location confirmation
  const handleNewBundleLocationConfirm = async (location: string) => {
    if (!pendingShipment) return;
    
    try {
      // Save location to the shipment
      const { error } = await supabase
        .from('shipments')
        .update({ location_id: location })
        .eq('id', pendingShipment.id);

      if (error) throw error;
      
      // Update local state
      const updatedShipment = { ...pendingShipment, location_id: location };
      setSelectedShipment(updatedShipment);
      setRecommendedLocation(location);
      setLocationAcknowledged(true);
      
      // Update in group items too
      setGroupItems(prev => prev.map(item => 
        item.id === pendingShipment.id ? { ...item, location_id: location } : item
      ));
      
      toast.success(`Location ${location} assigned`, {
        description: 'Place devices at this location'
      });
      
      // Close dialog
      setNewBundleDialogOpen(false);
      setPendingShipment(null);
      
      // Auto-print if enabled
      if (settings.auto_print) {
        await handlePrint(updatedShipment);
      }
    } catch (error: any) {
      toast.error('Failed to assign location', { description: error.message });
    }
  };

  const handlePrint = async (shipment: Shipment) => {
    // For bundle items, check if this is the last item in the group
    if (shipment.bundle) {
      if (!shipment.order_group_id) {
        toast.error('Cannot print: Missing group ID');
        return;
      }
      
      // Check how many unprinted items remain
      const { data: groupShipments, error } = await supabase
        .from('shipments')
        .select('id, printed, group_id_printed')
        .eq('order_group_id', shipment.order_group_id);

      if (error) {
        console.error('Failed to check group status:', error);
        toast.error('Failed to check group status');
        return;
      }

      const unprintedCount = groupShipments?.filter(s => !s.printed).length || 0;
      const isLastItem = unprintedCount === 1;
      
      // If last item in group, print manifest directly (skip Group ID flow)
      if (isLastItem) {
        toast.info('Last item in group - printing manifest + packing slip');
        // Fall through to manifest printing
      } else if (!shipment.group_id_printed) {
        // Not last item, print Group ID label
        return handlePrintGroupId(shipment);
      } else {
        // Group ID already printed but not last item
        toast.error('Group ID already printed for this item. Scan remaining items.');
        return;
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
      const { error: updateError } = await supabase
        .from('shipments')
        .update({ 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        })
        .eq('id', shipment.id);

      if (updateError) {
        console.error('Failed to update shipment:', updateError);
        throw new Error(`Failed to update shipment status: ${updateError.message}`);
      }

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
          status: 'done'
        });

      // Shipment updated in database, no need for local state update
      
      toast.success('Label printed!', {
        description: `Printed label for ${shipment.uid}`
      });

      // Check if this is a Label Only order and print pick list
      if (isLabelOnlyOrder(shipment)) {
        try {
          let pickListItems: any[] = [];
          
          // For bundles, get all items in the group
          if (shipment.bundle && shipment.order_group_id) {
            pickListItems = groupItems.map(item => ({
              product_name: item.product_name || '',
              uid: item.uid,
              quantity: item.quantity || 1
            }));
          } else {
            // Single item
            pickListItems = [{
              product_name: shipment.product_name || '',
              uid: shipment.uid,
              quantity: shipment.quantity || 1
            }];
          }

          const pickListData: PickListData = {
            buyer: shipment.buyer || '',
            tracking: shipment.tracking || '',
            order_id: shipment.order_id,
            items: pickListItems
          };

          const pickListJob = createPickListPrintJob(
            parseInt(printerId),
            pickListData
          );

          await submitPrintJob(printnodeApiKey, pickListJob);
          
          toast.success('Pick list printed!', {
            description: 'Pick list printed successfully'
          });
        } catch (error: any) {
          toast.error('Pick list print failed', {
            description: error.message
          });
        }
      }

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

    // Check if all bundle items have location IDs
    const unprocessedItems = groupItems.filter(item => !item.location_id);
    
    if (unprocessedItems.length > 0) {
      toast.warning('Not all items have locations', {
        description: `${unprocessedItems.length} item(s) need location IDs. Only items with locations will be marked as printed.`
      });
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

      // Mark items that have location as printed (regardless of group_id_printed)
      const { error: updateError } = await supabase
        .from('shipments')
        .update({ 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        })
        .eq('order_group_id', selectedShipment.order_group_id)
        .not('location_id', 'is', null);

      if (updateError) {
        console.error('Failed to update shipments:', updateError);
        throw new Error(`Failed to update shipment status: ${updateError.message}`);
      }

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
          status: 'done'
        });

      toast.success('All items marked as printed!', {
        description: `Printed manifest for group`
      });

      // Check if this is a Label Only order and print pick list
      if (isLabelOnlyOrder(selectedShipment)) {
        try {
          const pickListItems = groupItems.map(item => ({
            product_name: item.product_name || '',
            uid: item.uid,
            quantity: item.quantity || 1
          }));

          const pickListData: PickListData = {
            buyer: selectedShipment.buyer || '',
            tracking: selectedShipment.tracking || '',
            order_id: selectedShipment.order_id,
            items: pickListItems
          };

          const pickListJob = createPickListPrintJob(
            parseInt(printerId),
            pickListData
          );

          await submitPrintJob(printnodeApiKey, pickListJob);
          
          toast.success('Pick list printed!', {
            description: 'Pick list printed successfully'
          });
        } catch (error: any) {
          toast.error('Pick list print failed', {
            description: error.message
          });
        }
      }

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
      const { error: updateError } = await supabase
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

      if (updateError) {
        console.error('Failed to update shipment:', updateError);
        throw new Error(`Failed to update shipment status: ${updateError.message}`);
      }

      // Update local state to reflect the change
      setGroupItems(prev => prev.map(item => 
        item.id === shipment.id 
          ? { 
              ...item, 
              group_id_printed: true,
              group_id_printed_at: new Date().toISOString(),
              group_id_printed_by_user_id: user.id,
              printed: true,
              printed_at: new Date().toISOString(),
              printed_by_user_id: user.id
            } 
          : item
      ));

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
          status: 'done'
        });
      
      toast.success('Group ID label printed!', {
        description: `Printed group ID for bundle ${shipment.uid}`
      });

      // Check if this is a Label Only order and print pick list
      if (isLabelOnlyOrder(shipment)) {
        try {
          const pickListData: PickListData = {
            buyer: shipment.buyer || '',
            tracking: shipment.tracking || '',
            order_id: shipment.order_id,
            items: [{
              product_name: shipment.product_name || '',
              uid: shipment.uid,
              quantity: shipment.quantity || 1
            }]
          };

          const pickListJob = createPickListPrintJob(
            parseInt(printerId),
            pickListData
          );

          await submitPrintJob(printnodeApiKey, pickListJob);
          
          toast.success('Pick list printed!', {
            description: 'Pick list printed for this item'
          });
        } catch (error: any) {
          toast.error('Pick list print failed', {
            description: error.message
          });
        }
      }

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
    <div className="w-full px-6 py-4 space-y-4">
      {/* Top Header with Printer ID */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Printer ID:</label>
          <Input
            type="number"
            value={printerId}
            onChange={(e) => handlePrinterIdChange(e.target.value)}
            placeholder="Enter printer ID..."
            className="w-32 h-9"
          />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold">SCAN LABEL</h1>
          <p className="text-sm text-muted-foreground">Scan barcode with handheld scanner</p>
        </div>
        <div className="w-32"></div> {/* Spacer for balance */}
      </div>

      {/* UID Input Section */}
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <form onSubmit={handleScan} className="space-y-4">
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
            <Button type="submit" className="w-full h-12 text-lg">
              Lookup
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Two-Column Layout: Shipment Details (Left) + Group Items (Right) */}
      {selectedShipment && (
        <div className="grid lg:grid-cols-[40%_60%] gap-4 items-start">
          {/* Left Column - Shipment Details */}
          <Card className={selectedShipment.bundle ? "border-4 border-primary bg-primary/10" : "border-2 border-primary"}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>Shipment Found</span>
                  {selectedShipment.bundle && (
                    <>
                      <Badge variant="secondary" className="text-sm">
                        Bundle Item
                      </Badge>
                      <Badge variant="outline" className="text-sm">
                        {totalGroupItems} items
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
              
              {/* Charger Warning - Main Display (informational only) */}
              {selectedShipment.bundle && selectedShipment.channel !== 'misfits' && groupItems.length > 0 && (
                <div className="mt-4">
                  <ChargerWarning 
                    items={groupItems}
                    channel={selectedShipment.channel}
                    requireAcknowledgment={false}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">UID</p>
                  <p className="font-mono font-bold text-sm">{selectedShipment.uid}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="font-mono text-sm">{selectedShipment.order_id}</p>
                </div>
                {selectedShipment.order_group_id && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Group ID</p>
                    <p 
                      className="font-mono text-xs break-all cursor-pointer hover:text-primary hover:underline" 
                      title="Click to view all bundle items in Orders"
                      onClick={() => navigate(`/orders?search=${selectedShipment.order_group_id}&filter=all`)}
                    >
                      {selectedShipment.order_group_id}
                    </p>
                  </div>
                )}
                {selectedShipment.bundle && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">
                      Location ID {!selectedShipment.location_id && <span className="text-destructive">*</span>}
                      {!recommendedLocation && !selectedShipment.location_id && (
                        <span className="text-xs ml-2 text-primary">(New bundle - location suggested)</span>
                      )}
                      {recommendedLocation && selectedShipment.location_id && (
                        <span className="text-xs ml-2 text-success">✓ Confirmed at {selectedShipment.location_id}</span>
                      )}
                    </p>
                    {!recommendedLocation && !selectedShipment.location_id ? (
                      <Button 
                        onClick={() => setNewBundleDialogOpen(true)}
                        variant="default"
                        className="w-full h-12 mt-1 text-lg"
                      >
                        <MapPin className="h-5 w-5 mr-2" />
                        View Suggested Location
                      </Button>
                    ) : recommendedLocation && !selectedShipment.location_id ? (
                      <Button 
                        onClick={() => setLocationDialogOpen(true)}
                        variant="outline"
                        className="w-full h-9 mt-1 border-primary text-primary hover:bg-primary/10"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Confirm Bundle Location
                      </Button>
                    ) : (
                      <Input
                        value={editingLocationIds[selectedShipment.id] ?? selectedShipment.location_id ?? ''}
                        onChange={(e) => setEditingLocationIds(prev => ({ 
                          ...prev, 
                          [selectedShipment.id]: e.target.value 
                        }))}
                        onBlur={(e) => {
                          if (editingLocationIds[selectedShipment.id] !== undefined) {
                            handleLocationIdChange(selectedShipment.id, e.target.value);
                            setSelectedShipment({ ...selectedShipment, location_id: e.target.value });
                            if (recommendedLocation) {
                              setLocationAcknowledged(true);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleLocationIdChange(selectedShipment.id, e.currentTarget.value);
                            setSelectedShipment({ ...selectedShipment, location_id: e.currentTarget.value });
                            if (recommendedLocation) {
                              setLocationAcknowledged(true);
                            }
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder="Enter location..."
                        className="h-9 mt-1"
                        disabled={recommendedLocation && !locationAcknowledged}
                      />
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Buyer</p>
                  <p className="font-semibold text-sm">{selectedShipment.buyer}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="text-sm">{selectedShipment.product_name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Shipping Address</p>
                  <p className="text-sm">{selectedShipment.address_full}</p>
                </div>
                {selectedShipment.tracking && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Tracking</p>
                    <p className="font-mono text-sm">{selectedShipment.tracking}</p>
                  </div>
                )}
              </div>

              {/* Compact Charger Warning - Right before Print Button */}
              {selectedShipment.bundle && !selectedShipment.group_id_printed && selectedShipment.channel !== 'misfits' && groupItems.length > 0 && (
                <ChargerWarning items={groupItems} compact channel={selectedShipment.channel} />
              )}

              {(selectedShipment.manifest_url || selectedShipment.bundle) && (
                <Button
                  onClick={() => handlePrint(selectedShipment)}
                  disabled={
                    printing || 
                    (selectedShipment.bundle && selectedShipment.group_id_printed && !isLastInGroup) ||
                    (selectedShipment.bundle && !isLastInGroup && !selectedShipment.group_id_printed && (!selectedShipment.location_id || selectedShipment.location_id.trim() === '')) ||
                    (selectedShipment.bundle && !isLastInGroup && recommendedLocation && !locationAcknowledged)
                  }
                  size="lg"
                  className="w-full"
                >
                  <Printer className="h-5 w-5 mr-2" />
                  {printing ? 'Printing...' : (selectedShipment.bundle && !selectedShipment.group_id_printed) ? 'Print Group ID Label' : 'Print Label'}
                </Button>
              )}
              
              {/* Show blocking reasons */}
              {selectedShipment.bundle && !selectedShipment.group_id_printed && (
                <div className="space-y-1 text-xs text-center">
                  {(!selectedShipment.location_id || selectedShipment.location_id.trim() === '') && (
                    <p className="text-destructive">
                      ⚠️ Location ID is required
                    </p>
                  )}
                  {recommendedLocation && !locationAcknowledged && selectedShipment.location_id && (
                    <p className="text-warning">
                      ⚠️ Please confirm bundle location
                    </p>
                  )}
                  {selectedShipment.channel !== 'misfits' && groupItems.length > 0 && !chargersAcknowledged && (
                    <p className="text-destructive">
                      ⚠️ Please acknowledge charger requirements
                    </p>
                  )}
                </div>
              )}
              
              {selectedShipment.bundle && selectedShipment.group_id_printed && (
                <div className="text-xs text-muted-foreground text-center">
                  Group ID printed on {new Date(selectedShipment.group_id_printed_at!).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Column - Group Items */}
          {selectedShipment?.bundle && groupItems.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Group Items ({groupItems.length})</CardTitle>
                  <div className="flex flex-col items-end gap-1">
                    <Button 
                      onClick={handlePrintAllGroupManifests}
                      disabled={
                        printing || 
                        groupItems.every(item => item.printed) ||
                        groupItems.some(item => !item.location_id)
                      }
                      variant="default"
                      size="sm"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Mark All Printed
                    </Button>
                    {groupItems.some(item => !item.location_id) && (
                      <p className="text-xs text-muted-foreground">
                        {groupItems.filter(item => !item.location_id).length} item(s) 
                        {' '}need location IDs
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>UID</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Status</TableHead>
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
                              {recommendedLocation && !item.location_id ? (
                                <Badge variant="outline" className="text-xs">
                                  → {recommendedLocation}
                                </Badge>
                              ) : (
                                <Input
                                  value={editingLocationIds[item.id] ?? item.location_id ?? ''}
                                  onChange={(e) => setEditingLocationIds(prev => ({ 
                                    ...prev, 
                                    [item.id]: e.target.value 
                                  }))}
                                  onBlur={(e) => {
                                    if (editingLocationIds[item.id] !== undefined) {
                                      handleLocationIdChange(item.id, e.target.value);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleLocationIdChange(item.id, e.currentTarget.value);
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  placeholder="Location"
                                  className="w-24 h-8 text-xs"
                                  disabled={!!recommendedLocation && !item.location_id}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{item.product_name}</TableCell>
                            <TableCell className="text-xs">{item.buyer}</TableCell>
                            <TableCell className="text-center">
                              {item.printed ? (
                                <Badge className="bg-success text-success-foreground text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Printed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Pending</Badge>
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
                                  className="h-7 text-xs"
                                >
                                  <Printer className="h-3 w-3 mr-1" />
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
          ) : (
            <div className="flex items-center justify-center text-muted-foreground">
              {selectedShipment?.bundle ? 'Loading group items...' : ''}
            </div>
          )}
        </div>
      )}

      {/* Location Confirmation Dialog */}
      <Dialog 
        open={locationDialogOpen} 
        onOpenChange={(open) => {
          // Only allow closing if location has been acknowledged
          if (!open && !locationAcknowledged && recommendedLocation) {
            return; // Prevent closing
          }
          setLocationDialogOpen(open);
        }}
      >
        <DialogContent 
          className="sm:max-w-md"
          onPointerDownOutside={(e) => {
            if (!locationAcknowledged && recommendedLocation) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (!locationAcknowledged && recommendedLocation) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Bundle Location
            </DialogTitle>
            <DialogDescription>
              This bundle already has items at an existing location
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="text-center p-6 bg-primary/10 rounded-lg border-2 border-primary">
              <p className="text-sm text-muted-foreground">Recommended Location</p>
              <p className="text-4xl font-bold text-primary">{recommendedLocation}</p>
            </div>
          </div>
          
          {!overrideLocation ? (
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button 
                onClick={() => {
                  if (selectedShipment && recommendedLocation) {
                    handleLocationIdChange(selectedShipment.id, recommendedLocation);
                    setSelectedShipment({...selectedShipment, location_id: recommendedLocation});
                    setLocationAcknowledged(true);
                    setLocationDialogOpen(false);
                  }
                }}
                className="w-full"
                size="lg"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Use Location {recommendedLocation}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setOverrideLocation(true)}
                className="w-full"
              >
                Use Different Location
              </Button>
            </DialogFooter>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Warning: Using a different location may cause bundle items to be misplaced
                </p>
              </div>
              <div className="flex gap-2">
                <Input 
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Enter location..."
                  className="flex-1"
                  autoFocus
                />
              </div>
              <DialogFooter className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setOverrideLocation(false);
                    setCustomLocation('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (selectedShipment && customLocation.trim()) {
                      handleLocationIdChange(selectedShipment.id, customLocation);
                      setSelectedShipment({...selectedShipment, location_id: customLocation});
                      setLocationAcknowledged(true);
                      setLocationDialogOpen(false);
                      setOverrideLocation(false);
                      setCustomLocation('');
                    }
                  }}
                  disabled={!customLocation.trim()}
                  className="flex-1"
                >
                  Confirm Override
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Bundle Location Dialog */}
      <NewBundleLocationDialog
        open={newBundleDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            // If closing without confirming, clear pending state
            setPendingShipment(null);
          }
          setNewBundleDialogOpen(open);
        }}
        suggestedLocation={suggestedNewLocation}
        allLocationsOccupied={allLocationsOccupied}
        onConfirm={handleNewBundleLocationConfirm}
      />
    </div>
  );
}
