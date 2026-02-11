import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkAddLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCodes: string[];
  maxSortOrder: number;
  onComplete: () => void;
}

export function BulkAddLocationsDialog({ open, onOpenChange, existingCodes, maxSortOrder, onComplete }: BulkAddLocationsDialogProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [adding, setAdding] = useState(false);

  const preview = useMemo(() => {
    const start = parseInt(from);
    const end = parseInt(to);
    if (isNaN(start) || isNaN(end) || start > end || end - start > 500) return null;
    const newCodes: string[] = [];
    for (let i = start; i <= end; i++) {
      const code = String(i);
      if (!existingCodes.includes(code)) newCodes.push(code);
    }
    return { total: end - start + 1, newCodes, skipped: (end - start + 1) - newCodes.length };
  }, [from, to, existingCodes]);

  const handleAdd = async () => {
    if (!preview || preview.newCodes.length === 0) return;
    setAdding(true);
    try {
      const rows = preview.newCodes.map((code, i) => ({
        location_code: code,
        category: 'main',
        sort_order: maxSortOrder + 1 + i,
        is_active: true,
      }));
      const { error } = await supabase.from('bundle_locations').insert(rows);
      if (error) throw error;
      toast.success(`Added ${preview.newCodes.length} locations`);
      if (preview.skipped > 0) toast.info(`${preview.skipped} already existed and were skipped`);
      setFrom('');
      setTo('');
      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      toast.error('Failed to add locations', { description: error.message });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Add Locations</DialogTitle>
          <DialogDescription>Add a range of numeric locations at once</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="number" value={from} onChange={e => setFrom(e.target.value)} placeholder="e.g. 200" />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="number" value={to} onChange={e => setTo(e.target.value)} placeholder="e.g. 250" />
          </div>
        </div>
        {preview && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{preview.newCodes.length} to create</Badge>
            {preview.skipped > 0 && <Badge variant="secondary">{preview.skipped} already exist</Badge>}
          </div>
        )}
        {from && to && parseInt(to) - parseInt(from) > 500 && (
          <p className="text-sm text-destructive">Range too large (max 500)</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={adding || !preview || preview.newCodes.length === 0}>
            {adding ? 'Adding...' : 'Add Locations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
