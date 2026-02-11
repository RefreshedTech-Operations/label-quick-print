import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Plus, Eye, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BulkAddLocationsDialog } from '@/components/BulkAddLocationsDialog';
import { BulkDeleteLocationsDialog } from '@/components/BulkDeleteLocationsDialog';

interface LocationOccupancy {
  location_code: string;
  category: string;
  sort_order: number;
  is_active: boolean;
  is_occupied: boolean;
  order_group_id: string | null;
  buyer: string | null;
  printed_count: number;
  total_count: number;
}

export function BundleLocationsTab() {
  const [locations, setLocations] = useState<LocationOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newLocationCode, setNewLocationCode] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadLocations();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (!error) {
        setIsAdmin(data === true);
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  };

  const loadLocations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_location_occupancy');
      
      if (error) {
        console.error('Failed to load locations:', error);
        toast.error('Failed to load locations');
        return;
      }

      setLocations(data || []);
    } catch (error: any) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (locationCode: string, currentActive: boolean) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    // Optimistically update the UI
    setLocations(prev => prev.map(loc => 
      loc.location_code === locationCode 
        ? { ...loc, is_active: !currentActive }
        : loc
    ));

    try {
      const { error } = await supabase
        .from('bundle_locations')
        .update({ is_active: !currentActive })
        .eq('location_code', locationCode);

      if (error) throw error;

      toast.success(`Location ${locationCode} ${!currentActive ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      // Revert on error
      setLocations(prev => prev.map(loc => 
        loc.location_code === locationCode 
          ? { ...loc, is_active: currentActive }
          : loc
      ));
      toast.error('Failed to update location', { description: error.message });
    }
  };

  const handleAddLocation = async () => {
    if (!newLocationCode.trim()) {
      toast.error('Please enter a location code');
      return;
    }

    setAddingLocation(true);
    try {
      // Get the highest sort_order
      const maxSortOrder = locations.reduce((max, loc) => Math.max(max, loc.sort_order), 0);

      const { error } = await supabase
        .from('bundle_locations')
        .insert({
          location_code: newLocationCode.trim(),
          category: 'main',
          sort_order: maxSortOrder + 1,
          is_active: true
        });

      if (error) throw error;

      toast.success(`Location ${newLocationCode} added`);
      setNewLocationCode('');
      setAddDialogOpen(false);
      loadLocations();
    } catch (error: any) {
      toast.error('Failed to add location', { description: error.message });
    } finally {
      setAddingLocation(false);
    }
  };

  const handleDeleteLocation = async (locationCode: string) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    if (!confirm(`Are you sure you want to delete location ${locationCode}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bundle_locations')
        .delete()
        .eq('location_code', locationCode);

      if (error) throw error;

      toast.success(`Location ${locationCode} deleted`);
      loadLocations();
    } catch (error: any) {
      toast.error('Failed to delete location', { description: error.message });
    }
  };

  const handleViewBundle = (orderGroupId: string) => {
    navigate(`/orders?search=${orderGroupId}&filter=all`);
  };

  const activeLocations = locations.filter(l => l.is_active);
  const availableCount = activeLocations.filter(l => !l.is_occupied).length;
  const occupiedCount = activeLocations.filter(l => l.is_occupied).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Bundle Locations
            </CardTitle>
            <CardDescription>
              Manage physical locations for bundle staging
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {activeLocations.length} active
            </Badge>
            <Badge variant="secondary" className="text-sm bg-green-500/20 text-green-600">
              {availableCount} available
            </Badge>
            <Badge variant="secondary" className="text-sm bg-orange-500/20 text-orange-600">
              {occupiedCount} occupied
            </Badge>
            <Button variant="outline" size="sm" onClick={loadLocations} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isAdmin && (
              <>
                <Button size="sm" variant="outline" onClick={() => setBulkAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Bulk Add
                </Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/50" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Bulk Delete
                </Button>
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Location
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading locations...
          </div>
        ) : locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mb-2 opacity-50" />
            <p>No locations configured</p>
            {isAdmin && (
              <Button variant="outline" className="mt-4" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add First Location
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Location</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead className="w-24">Active</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.location_code} className={!location.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono font-bold text-lg">
                      {location.location_code}
                    </TableCell>
                    <TableCell>
                      {location.is_occupied ? (
                        <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">
                          Occupied
                        </Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                          Available
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {location.is_occupied && location.order_group_id ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {location.buyer || 'Unknown Buyer'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {location.printed_count}/{location.total_count} printed
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            Bundle: {location.order_group_id.substring(0, 8)}...
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Switch
                          checked={location.is_active}
                          onCheckedChange={() => handleToggleActive(location.location_code, location.is_active)}
                        />
                      ) : (
                        <Badge variant={location.is_active ? 'default' : 'secondary'}>
                          {location.is_active ? 'Yes' : 'No'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {location.is_occupied && location.order_group_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewBundle(location.order_group_id!)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && !location.is_occupied && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLocation(location.location_code)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add Location Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>
              Enter a location code for the new bundle staging area
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-code">Location Code</Label>
              <Input
                id="location-code"
                value={newLocationCode}
                onChange={(e) => setNewLocationCode(e.target.value)}
                placeholder="e.g., A1, B2, SHELF-1"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLocation} disabled={addingLocation}>
              {addingLocation ? 'Adding...' : 'Add Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkAddLocationsDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        existingCodes={locations.map(l => l.location_code)}
        maxSortOrder={locations.reduce((max, loc) => Math.max(max, loc.sort_order), 0)}
        onComplete={loadLocations}
      />

      <BulkDeleteLocationsDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        locations={locations.map(l => ({ location_code: l.location_code, is_occupied: l.is_occupied }))}
        onComplete={loadLocations}
      />
    </Card>
  );
}
