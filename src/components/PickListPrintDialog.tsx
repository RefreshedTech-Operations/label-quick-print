import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Printer, Package } from 'lucide-react';
import { createPickListPrintJob, PickListData } from '@/lib/pickList';
import { submitPrintJob } from '@/lib/printnode';
import { useAppStore } from '@/stores/useAppStore';
import { Progress } from '@/components/ui/progress';

interface PickListPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipments: any[];
  onComplete: () => void;
}

export default function PickListPrintDialog({
  open,
  onOpenChange,
  shipments,
  onComplete
}: PickListPrintDialogProps) {
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { settings } = useAppStore();

  // Group shipments by tracking number
  const groupedPickLists = () => {
    const groups = new Map<string, any[]>();
    
    shipments.forEach(shipment => {
      const key = shipment.tracking || shipment.order_id;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(shipment);
    });

    return Array.from(groups.entries()).map(([key, items]) => {
      const firstItem = items[0];
      return {
        buyer: firstItem.buyer,
        tracking: firstItem.tracking || 'No tracking',
        order_id: items.map(i => i.order_id).join(', '),
        items: items.map(item => ({
          product_name: item.product_name,
          uid: item.uid,
          quantity: item.quantity || 1
        }))
      } as PickListData;
    });
  };

  const pickLists = groupedPickLists();
  const singleOrders = pickLists.filter(p => p.items.length === 1).length;
  const bundles = pickLists.filter(p => p.items.length > 1).length;

  const handlePrintAll = async () => {
    if (!settings.default_printer_id) {
      toast.error('No default printer configured', {
        description: 'Please set a default printer in Settings'
      });
      return;
    }

    const apiKey = import.meta.env.VITE_PRINTNODE_API_KEY;
    if (!apiKey) {
      toast.error('PrintNode API key not configured');
      return;
    }

    setPrinting(true);
    setProgress(0);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < pickLists.length; i++) {
        const pickList = pickLists[i];
        
        try {
          const printJob = createPickListPrintJob(
            parseInt(settings.default_printer_id),
            pickList
          );
          
          await submitPrintJob(apiKey, printJob);
          successCount++;
        } catch (error: any) {
          console.error('Failed to print pick list:', error);
          failCount++;
        }

        setProgress(((i + 1) / pickLists.length) * 100);
      }

      if (successCount > 0) {
        toast.success(`Printed ${successCount} pick list(s)`, {
          description: failCount > 0 ? `${failCount} failed` : undefined
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast.error(`Failed to print ${failCount} pick list(s)`);
      }

      onComplete();
    } catch (error: any) {
      toast.error('Print job failed', {
        description: error.message
      });
    } finally {
      setPrinting(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Print Pick Lists
          </DialogTitle>
          <DialogDescription>
            Generate packing slips for each order/bundle
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">{singleOrders}</div>
              <div className="text-sm text-muted-foreground">Single Orders</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">{bundles}</div>
              <div className="text-sm text-muted-foreground">Bundles</div>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm">
              <div className="font-medium mb-1">Total pick lists to print:</div>
              <div className="text-2xl font-bold">{pickLists.length}</div>
            </div>
          </div>

          {printing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                Printing... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={printing}
          >
            Skip
          </Button>
          <Button
            onClick={handlePrintAll}
            disabled={printing || !settings.default_printer_id}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print All Pick Lists
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
