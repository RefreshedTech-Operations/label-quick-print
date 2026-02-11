import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LocationInfo {
  location_code: string;
  is_occupied: boolean;
}

interface BulkDeleteLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: LocationInfo[];
  onComplete: () => void;
}

export function BulkDeleteLocationsDialog({ open, onOpenChange, locations, onComplete }: BulkDeleteLocationsDialogProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deleting, setDeleting] = useState(false);

  const preview = useMemo(() => {
    const start = parseInt(from);
    const end = parseInt(to);
    if (isNaN(start) || isNaN(end) || start > end || end - start > 500) return null;

    const inRange = locations.filter(l => {
      const num = parseInt(l.location_code);
      return !isNaN(num) && l.location_code === String(num) && num >= start && num <= end;
    });
    const deletable = inRange.filter(l => !l.is_occupied);
    const occupied = inRange.filter(l => l.is_occupied);
    return { deletable, occupied, total: inRange.length };
  }, [from, to, locations]);

  const handleDelete = async () => {
    if (!preview || preview.deletable.length === 0) return;
    setDeleting(true);
    try {
      const codes = preview.deletable.map(l => l.location_code);
      const { error } = await supabase.from('bundle_locations').delete().in('location_code', codes);
      if (error) throw error;
      toast.success(`Deleted ${codes.length} locations`);
      if (preview.occupied.length > 0) {
        toast.warning(`${preview.occupied.length} occupied locations were skipped`);
      }
      setFrom('');
      setTo('');
      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      toast.error('Failed to delete locations', { description: error.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Delete Locations</DialogTitle>
          <DialogDescription>Delete a range of numeric locations. Occupied locations will be skipped.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="number" value={from} onChange={e => setFrom(e.target.value)} placeholder="e.g. 100" />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="number" value={to} onChange={e => setTo(e.target.value)} placeholder="e.g. 150" />
          </div>
        </div>
        {preview && (
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">{preview.deletable.length} to delete</Badge>
              {preview.occupied.length > 0 && (
                <Badge variant="secondary" className="bg-orange-500/20 text-orange-600">
                  {preview.occupied.length} occupied (skipped)
                </Badge>
              )}
            </div>
          </div>
        )}
        {from && to && parseInt(to) - parseInt(from) > 500 && (
          <p className="text-sm text-destructive">Range too large (max 500)</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting || !preview || preview.deletable.length === 0}>
            {deleting ? 'Deleting...' : 'Delete Locations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
