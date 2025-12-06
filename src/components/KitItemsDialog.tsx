import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, CheckCircle2 } from 'lucide-react';

interface KitItem {
  product_name: string;
  quantity: number;
}

interface KitItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kitItems: KitItem[];
  onConfirm: () => void;
}

export function KitItemsDialog({
  open,
  onOpenChange,
  kitItems,
  onConfirm,
}: KitItemsDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6 text-primary" />
            Gather Kit Items
          </DialogTitle>
          <DialogDescription>
            This bundle contains kit devices that need to be gathered before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-muted/50 rounded-lg p-4 border">
            <ul className="space-y-3">
              {kitItems.map((item, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between bg-background rounded-md p-3 border"
                >
                  <span className="font-medium">{item.product_name}</span>
                  <span className="text-lg font-bold text-primary">
                    ×{item.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            size="lg"
            className="w-full"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            I've gathered these items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
