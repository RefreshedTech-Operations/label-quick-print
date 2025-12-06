import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Package } from 'lucide-react';

interface KitDevice {
  id: string;
  product_name: string;
  created_at: string | null;
}

export function KitDevicesTab() {
  const [kitDevices, setKitDevices] = useState<KitDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [deviceToDelete, setDeviceToDelete] = useState<KitDevice | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadKitDevices();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data } = await supabase.rpc('is_admin');
    setIsAdmin(data === true);
  };

  const loadKitDevices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kit_devices')
      .select('*')
      .order('product_name');

    if (error) {
      console.error('Failed to load kit devices:', error);
      toast.error('Failed to load kit devices');
    } else {
      setKitDevices(data || []);
    }
    setLoading(false);
  };

  const handleAddDevice = async () => {
    if (!newProductName.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('kit_devices')
      .insert({
        product_name: newProductName.trim(),
        created_by_user_id: user?.id
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('This product name already exists');
      } else {
        toast.error('Failed to add kit device', { description: error.message });
      }
    } else {
      toast.success('Kit device added');
      setNewProductName('');
      setAddDialogOpen(false);
      loadKitDevices();
    }
    setSaving(false);
  };

  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;

    setSaving(true);
    const { error } = await supabase
      .from('kit_devices')
      .delete()
      .eq('id', deviceToDelete.id);

    if (error) {
      toast.error('Failed to delete kit device', { description: error.message });
    } else {
      toast.success('Kit device removed');
      setDeviceToDelete(null);
      setDeleteDialogOpen(false);
      loadKitDevices();
    }
    setSaving(false);
  };

  const openDeleteDialog = (device: KitDevice) => {
    setDeviceToDelete(device);
    setDeleteDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kit Devices
          </CardTitle>
          <CardDescription>
            Products that require gathering when part of a bundle
          </CardDescription>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : kitDevices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No kit devices configured. {isAdmin && 'Click "Add Device" to add one.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {kitDevices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.product_name}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(device)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Device Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Kit Device</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter product name (e.g., Super Bass Bluetooth Headphones)"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDevice()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDevice} disabled={saving}>
              {saving ? 'Adding...' : 'Add Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Kit Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deviceToDelete?.product_name}" from kit devices?
              This will no longer trigger gathering prompts for this product.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDevice}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
