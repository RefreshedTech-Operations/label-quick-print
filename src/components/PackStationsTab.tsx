import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Package2, Plus, RefreshCw, Trash2, Pencil } from 'lucide-react';

interface PackStation {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export function PackStationsTab() {
  const [stations, setStations] = useState<PackStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [addingStation, setAddingStation] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<PackStation | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    loadStations();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (!error) setIsAdmin(data === true);
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  };

  const loadStations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pack_stations')
        .select('*')
        .order('sort_order');

      if (error) {
        toast.error('Failed to load pack stations');
        return;
      }
      setStations(data || []);
    } catch (error: any) {
      toast.error('Failed to load pack stations');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    setStations(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentActive } : s));

    try {
      const { error } = await supabase
        .from('pack_stations')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Station ${!currentActive ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      setStations(prev => prev.map(s => s.id === id ? { ...s, is_active: currentActive } : s));
      toast.error('Failed to update station', { description: error.message });
    }
  };

  const handleAddStation = async () => {
    if (!newStationName.trim()) {
      toast.error('Please enter a station name');
      return;
    }

    setAddingStation(true);
    try {
      const maxSortOrder = stations.reduce((max, s) => Math.max(max, s.sort_order), 0);

      const { error } = await supabase
        .from('pack_stations')
        .insert({
          name: newStationName.trim(),
          sort_order: maxSortOrder + 1,
          is_active: true,
        });

      if (error) {
        if (error.code === '23505') toast.error('Station name already exists');
        else throw error;
        return;
      }

      toast.success(`Station "${newStationName.trim()}" added`);
      setNewStationName('');
      setAddDialogOpen(false);
      loadStations();
    } catch (error: any) {
      toast.error('Failed to add station', { description: error.message });
    } finally {
      setAddingStation(false);
    }
  };

  const handleDeleteStation = async (id: string, name: string) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    if (!confirm(`Are you sure you want to delete station "${name}"?`)) return;

    try {
      const { error } = await supabase.from('pack_stations').delete().eq('id', id);
      if (error) throw error;
      toast.success(`Station "${name}" deleted`);
      loadStations();
    } catch (error: any) {
      toast.error('Failed to delete station', { description: error.message });
    }
  };

  const openRename = (station: PackStation) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    setRenameTarget(station);
    setRenameValue(station.name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const newName = renameValue.trim();
    if (!newName) {
      toast.error('Please enter a station name');
      return;
    }
    if (newName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setRenaming(true);
    try {
      const { error } = await supabase
        .from('pack_stations')
        .update({ name: newName })
        .eq('id', renameTarget.id);
      if (error) {
        if (error.code === '23505') toast.error('Station name already exists');
        else throw error;
        return;
      }
      toast.success(`Renamed to "${newName}"`);
      setRenameTarget(null);
      loadStations();
    } catch (error: any) {
      toast.error('Failed to rename station', { description: error.message });
    } finally {
      setRenaming(false);
    }
  };

  const activeStations = stations.filter(s => s.is_active);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Pack Stations
            </CardTitle>
            <CardDescription>
              Manage packing stations used on the Pack page
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {activeStations.length} active
            </Badge>
            <Button variant="outline" size="sm" onClick={loadStations} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isAdmin && (
              <>
                {selectedForDelete.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected ({selectedForDelete.size})
                  </Button>
                )}
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Station
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading stations...
          </div>
        ) : stations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package2 className="h-12 w-12 mb-2 opacity-50" />
            <p>No pack stations configured</p>
            {isAdmin && (
              <Button variant="outline" className="mt-4" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add First Station
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead className="w-10"></TableHead>}
                  <TableHead>Station Name</TableHead>
                  <TableHead className="w-24">Active</TableHead>
                  {isAdmin && <TableHead className="w-32">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map((station) => (
                  <TableRow key={station.id} className={!station.is_active ? 'opacity-50' : ''}>
                    {isAdmin && (
                      <TableCell>
                        <Checkbox
                          checked={selectedForDelete.has(station.id)}
                          onCheckedChange={(checked) => {
                            setSelectedForDelete(prev => {
                              const next = new Set(prev);
                              if (checked) next.add(station.id);
                              else next.delete(station.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{station.name}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Switch
                          checked={station.is_active}
                          onCheckedChange={() => handleToggleActive(station.id, station.is_active)}
                        />
                      ) : (
                        <Badge variant={station.is_active ? 'default' : 'secondary'}>
                          {station.is_active ? 'Yes' : 'No'}
                        </Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRename(station)}
                            title="Rename"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStation(station.id, station.name)}
                            className="text-destructive hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Rename Station Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Pack Station</DialogTitle>
            <DialogDescription>
              Update the name for "{renameTarget?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-station-name">Station Name</Label>
              <Input
                id="rename-station-name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renaming}>
              {renaming ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Station Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Pack Station</DialogTitle>
            <DialogDescription>
              Enter a name for the new packing station
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="station-name">Station Name</Label>
              <Input
                id="station-name"
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                placeholder='e.g., "Station 1", "Table A"'
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddStation()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStation} disabled={addingStation}>
              {addingStation ? 'Adding...' : 'Add Station'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Bulk Delete Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedForDelete.size} station{selectedForDelete.size !== 1 ? 's' : ''}?
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto">
            <div className="flex flex-wrap gap-1">
              {[...selectedForDelete].map(id => {
                const station = stations.find(s => s.id === id);
                return station ? (
                  <Badge key={id} variant="outline">{station.name}</Badge>
                ) : null;
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={bulkDeleting}
              onClick={async () => {
                setBulkDeleting(true);
                try {
                  const ids = [...selectedForDelete];
                  const { error } = await supabase.from('pack_stations').delete().in('id', ids);
                  if (error) throw error;
                  toast.success(`Deleted ${ids.length} stations`);
                  setSelectedForDelete(new Set());
                  setConfirmDeleteOpen(false);
                  loadStations();
                } catch (error: any) {
                  toast.error('Failed to delete stations', { description: error.message });
                } finally {
                  setBulkDeleting(false);
                }
              }}
            >
              {bulkDeleting ? 'Deleting...' : `Delete ${selectedForDelete.size} Stations`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
