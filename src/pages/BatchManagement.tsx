import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Package2, CalendarIcon, Clock, AlertCircle, CheckCircle2, Trash2, Edit2, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Batch } from '@/types/batch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function BatchManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'manage';
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [batchToEdit, setBatchToEdit] = useState<Batch | null>(null);
  const [editBatchName, setEditBatchName] = useState('');
  const [editBatchStatus, setEditBatchStatus] = useState('');
  
  // Scanning state
  const [currentBatch, setCurrentBatch] = useState<string | null>(null);
  const [batchDetails, setBatchDetails] = useState<Batch | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [scannedPackages, setScannedPackages] = useState<any[]>([]);
  const [batchName, setBatchName] = useState('');
  const [batchShowDate, setBatchShowDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && activeTab === 'manage') {
      loadBatches();
    }
  }, [user, statusFilter, activeTab]);

  useEffect(() => {
    if (currentBatch) {
      loadScannedPackages();
    }
  }, [currentBatch]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to access batch management');
      return;
    }
    setUser(user);
    
    // Check if user is admin
    const { data: adminCheck } = await supabase.rpc('is_admin');
    setIsAdmin(adminCheck || false);
    
    setLoading(false);
  };

  const loadBatches = async () => {
    let query = supabase
      .from('batches')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load batches');
      console.error(error);
      return;
    }

    setBatches((data as Batch[]) || []);
  };

  const loadScannedPackages = async () => {
    if (!currentBatch) return;

    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('batch_id', currentBatch)
      .order('batch_scanned_at', { ascending: false });

    if (error) {
      console.error('Failed to load scanned packages:', error);
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
        show_date: batchShowDate?.toISOString().split('T')[0] || null,
        created_by_user_id: user.id,
        status: 'scanning'
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create batch');
      console.error(error);
      return;
    }

    setCurrentBatch(data.id);
    setBatchDetails(data as Batch);
    toast.success('Batch created successfully');
  };

  const scanPackage = async () => {
    if (!trackingNumber.trim() || !currentBatch) return;

    let trackingUpper = trackingNumber.trim().toUpperCase();

    // If scanned input is longer than expected (has routing prefix), 
    // strip the first 12 characters to get the actual tracking number
    if (trackingUpper.length > 22) {
      const originalInput = trackingUpper;
      trackingUpper = trackingUpper.substring(12);
      console.log(`Stripped prefix: ${originalInput} → ${trackingUpper}`);
    }

    const { data: shipments, error: searchError } = await supabase
      .from('shipments')
      .select('*')
      .ilike('tracking', trackingUpper)
      .limit(1);

    if (searchError) {
      toast.error('Error searching for package');
      console.error(searchError);
      setTrackingNumber('');
      return;
    }

    if (!shipments || shipments.length === 0) {
      toast.error('Package not found', {
        description: `No package found with tracking: ${trackingUpper}`
      });
      setTrackingNumber('');
      return;
    }

    const shipment = shipments[0];

    if (shipment.batch_id === currentBatch) {
      toast.error('Already scanned', {
        description: 'This package is already in the current batch'
      });
      setTrackingNumber('');
      return;
    }

    if (shipment.batch_id) {
      toast.error('Package in another batch', {
        description: 'This package is already assigned to a different batch'
      });
      setTrackingNumber('');
      return;
    }

    // Show warning if show dates don't match, but don't block the scan
    if (batchDetails?.show_date && shipment.show_date && shipment.show_date !== batchDetails.show_date) {
      toast.warning('Show date difference', {
        description: `Package show date is ${shipment.show_date} (batch: ${batchDetails.show_date})`,
        duration: 2000
      });
    }

    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        batch_id: currentBatch,
        batch_scanned_at: new Date().toISOString(),
        batch_scanned_by_user_id: user.id
      })
      .eq('id', shipment.id);

    if (updateError) {
      toast.error('Failed to update package');
      console.error(updateError);
      setTrackingNumber('');
      return;
    }

    const { error: countError } = await supabase.rpc('increment_batch_count', {
      batch_uuid: currentBatch
    });

    if (countError) {
      console.error('Failed to increment batch count:', countError);
    }

    await loadScannedPackages();

    const { data: updatedBatch } = await supabase
      .from('batches')
      .select('*')
      .eq('id', currentBatch)
      .single();

    if (updatedBatch) {
      setBatchDetails(updatedBatch as Batch);
    }

    toast.success('Package scanned', {
      description: `${shipment.tracking} added to batch`
    });

    setTrackingNumber('');
  };

  const completeBatch = async () => {
    if (!currentBatch) return;

    const { error } = await supabase
      .from('batches')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString()
      })
      .eq('id', currentBatch);

    if (error) {
      toast.error('Failed to complete batch');
      console.error(error);
      return;
    }

    toast.success('Batch completed');
    setCurrentBatch(null);
    setBatchDetails(null);
    setBatchName('');
    setBatchShowDate(undefined);
    setScannedPackages([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scanning':
        return 'bg-blue-500';
      case 'complete':
        return 'bg-green-500';
      case 'shipped':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;

    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', batchToDelete.id);

    if (error) {
      toast.error('Failed to delete batch');
      console.error(error);
      return;
    }

    toast.success('Batch deleted successfully');
    setDeleteDialogOpen(false);
    setBatchToDelete(null);
    loadBatches();
  };

  const openEditDialog = (batch: Batch) => {
    setBatchToEdit(batch);
    setEditBatchName(batch.name);
    setEditBatchStatus(batch.status);
    setEditDialogOpen(true);
  };

  const handleEditBatch = async () => {
    if (!batchToEdit) return;

    const { error } = await supabase
      .from('batches')
      .update({
        name: editBatchName,
        status: editBatchStatus
      })
      .eq('id', batchToEdit.id);

    if (error) {
      toast.error('Failed to update batch');
      console.error(error);
      return;
    }

    toast.success('Batch updated successfully');
    setEditDialogOpen(false);
    setBatchToEdit(null);
    loadBatches();
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Batch Management</h1>
        <p className="text-muted-foreground">Scan packages and manage shipping batches</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="scan">Scan Batch</TabsTrigger>
          <TabsTrigger value="manage">Manage Batches</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-6">
          {!currentBatch ? (
            <Card>
              <CardHeader>
                <CardTitle>Create New Batch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batch-name">Batch Name</Label>
                  <Input
                    id="batch-name"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="Enter batch name (e.g., 'March Orders')"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>Show Date Filter (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !batchShowDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {batchShowDate ? format(batchShowDate, 'PPP') : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={batchShowDate}
                        onSelect={setBatchShowDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Only packages with this show date will be allowed in the batch
                  </p>
                </div>

                <Button onClick={createBatch} className="w-full">
                  Create Batch
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{batchDetails?.name}</CardTitle>
                    <Badge variant="secondary" className="text-lg px-4 py-1">
                      {batchDetails?.package_count || 0} packages
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tracking">Scan Tracking Number</Label>
                    <Input
                      id="tracking"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && scanPackage()}
                      placeholder="Scan or enter tracking number"
                      autoFocus
                      className="text-lg h-14"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={scanPackage} className="flex-1" size="lg">
                      Add Package
                    </Button>
                    <Button onClick={completeBatch} variant="outline" size="lg">
                      Complete Batch
                    </Button>
                  </div>
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
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <div>
                              <p className="font-medium">{pkg.tracking}</p>
                              <p className="text-sm text-muted-foreground">{pkg.buyer}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(pkg.batch_scanned_at), 'h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('all')}
            >
              All Batches
            </Button>
            <Button
              variant={statusFilter === 'scanning' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('scanning')}
            >
              Scanning
            </Button>
            <Button
              variant={statusFilter === 'complete' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('complete')}
            >
              Complete
            </Button>
            <Button
              variant={statusFilter === 'shipped' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('shipped')}
            >
              Shipped
            </Button>
          </div>

          {batches.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package2 className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No batches found</p>
                <p className="text-muted-foreground mb-4">
                  {statusFilter === 'all'
                    ? 'Create your first batch to get started'
                    : `No batches with status: ${statusFilter}`}
                </p>
                <Button onClick={() => handleTabChange('scan')}>
                  Create New Batch
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {batches.map((batch) => (
                <Card key={batch.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg line-clamp-2">{batch.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(batch.status)}>
                          {getStatusLabel(batch.status)}
                        </Badge>
                        {(batch.created_by_user_id === user.id || isAdmin) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(batch)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit Batch
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setBatchToDelete(batch);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Batch
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Package2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-lg">{batch.package_count}</span>
                      <span className="text-muted-foreground">packages</span>
                    </div>

                    {batch.show_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Show: {format(new Date(batch.show_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Created: {format(new Date(batch.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>

                    {batch.completed_at && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Completed: {format(new Date(batch.completed_at), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                    )}

                    {batch.status === 'scanning' && (
                      <Button
                        onClick={() => {
                          setCurrentBatch(batch.id);
                          setBatchDetails(batch);
                          handleTabChange('scan');
                        }}
                        className="w-full mt-2"
                        size="sm"
                      >
                        Continue Scanning
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{batchToDelete?.name}"? This action cannot be undone.
              {batchToDelete && batchToDelete.package_count > 0 && (
                <span className="block mt-2 font-semibold text-destructive">
                  Warning: This batch contains {batchToDelete.package_count} packages. Deleting will remove the batch association from all packages.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBatch} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Batch Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-batch-name">Batch Name</Label>
              <Input
                id="edit-batch-name"
                value={editBatchName}
                onChange={(e) => setEditBatchName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-batch-status">Status</Label>
              <select
                id="edit-batch-status"
                value={editBatchStatus}
                onChange={(e) => setEditBatchStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="scanning">Scanning</option>
                <option value="complete">Complete</option>
                <option value="shipped">Shipped</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditBatch}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
