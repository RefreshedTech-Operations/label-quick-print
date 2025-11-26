import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Zap } from 'lucide-react';
import { Shipment } from '@/types';

interface ChargerRequirements {
  chromebookCount: number;
  macbookCount: number;
}

interface ChargerWarningProps {
  items: Shipment[];
  compact?: boolean;
}

const getChargerRequirements = (items: Shipment[]): ChargerRequirements => {
  let chromebookCount = 0;
  let macbookCount = 0;
  
  items.forEach(item => {
    const productLower = (item.product_name || '').toLowerCase();
    const quantity = item.quantity || 1;
    
    if (productLower.includes('chromebook')) {
      chromebookCount += quantity;
    }
    if (productLower.includes('macbook')) {
      macbookCount += quantity;
    }
  });
  
  return { chromebookCount, macbookCount };
};

export function ChargerWarning({ items, compact = false }: ChargerWarningProps) {
  const { chromebookCount, macbookCount } = getChargerRequirements(items);
  
  // Don't render if no chargers needed
  if (chromebookCount === 0 && macbookCount === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500 rounded text-sm">
        <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
        <span className="font-semibold text-amber-900 dark:text-amber-100">
          Charger Reminder:
        </span>
        <span className="text-amber-800 dark:text-amber-200">
          {chromebookCount > 0 && `${chromebookCount}x 45W USB-C`}
          {chromebookCount > 0 && macbookCount > 0 && ' • '}
          {macbookCount > 0 && `${macbookCount}x MagSafe`}
        </span>
      </div>
    );
  }

  return (
    <Alert className="bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500 border-t border-r border-b border-amber-200 dark:border-amber-800">
      <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse" />
      <AlertTitle className="text-amber-900 dark:text-amber-100 font-bold">
        ⚡ CHARGER REMINDER
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <div className="mt-2 space-y-1">
          <p className="font-semibold">Include with this bundle:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            {chromebookCount > 0 && (
              <li>
                <span className="font-bold">{chromebookCount}x 45W USB-C Charger</span>
                {chromebookCount > 1 ? 's' : ''} (for Chromebook{chromebookCount > 1 ? 's' : ''})
              </li>
            )}
            {macbookCount > 0 && (
              <li>
                <span className="font-bold">{macbookCount}x MagSafe Charger</span>
                {macbookCount > 1 ? 's' : ''} (for MacBook{macbookCount > 1 ? 's' : ''})
              </li>
            )}
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
}
