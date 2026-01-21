import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Zap } from 'lucide-react';
import { Shipment } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ChargerRequirements {
  chromebookCount: number;
  macbookCount: number;
  windowsPCCount: number;
}

interface ChargerWarningProps {
  items: Shipment[];
  compact?: boolean;
  channel?: string;
  requireAcknowledgment?: boolean;
  acknowledged?: boolean;
  onAcknowledge?: (acknowledged: boolean) => void;
}

const getChargerRequirements = (items: Shipment[]): ChargerRequirements => {
  let chromebookCount = 0;
  let macbookCount = 0;
  let windowsPCCount = 0;
  
  // Known Chromebook model patterns
  const chromebookPatterns = [
    /chromebook/i,
    /acer.*r752/i,
    /acer.*c733/i,
    /acer.*c7\d{2}/i,
    /dell.*3100/i,
    /dell.*3110/i,
    /dell.*3400/i,
    /lenovo.*100e/i,
    /lenovo.*300e/i,
    /lenovo.*500e/i,
    /NX\.A94AA/i,
    /NX\.H8VAA/i,
    /81ER/i,
  ];
  
  const macbookPatterns = [/macbook/i, /apple.*laptop/i];
  
  const windowsPCPatterns = [
    /latitude/i,
    /optiplex/i,
    /surface/i,
    /thinkpad.*(?!chromebook)/i,
    /inspiron/i,
    /pavilion/i,
    /elitebook/i,
    /probook/i,
  ];
  
  items.forEach(item => {
    const productName = item.product_name || '';
    const quantity = item.quantity || 1;
    
    if (chromebookPatterns.some(p => p.test(productName))) {
      chromebookCount += quantity;
    } else if (macbookPatterns.some(p => p.test(productName))) {
      macbookCount += quantity;
    } else if (windowsPCPatterns.some(p => p.test(productName))) {
      windowsPCCount += quantity;
    }
  });
  
  return { chromebookCount, macbookCount, windowsPCCount };
};

export function ChargerWarning({ 
  items, 
  compact = false, 
  channel, 
  requireAcknowledgment = false,
  acknowledged = false,
  onAcknowledge 
}: ChargerWarningProps) {
  const { chromebookCount, macbookCount, windowsPCCount } = getChargerRequirements(items);
  
  // Don't render if no chargers needed
  if (chromebookCount === 0 && macbookCount === 0 && windowsPCCount === 0) {
    return null;
  }

  // Don't render for misfits or outlet channels (no chargers needed)
  if (channel === 'misfits' || channel === 'outlet') {
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
          {chromebookCount > 0 && (macbookCount > 0 || windowsPCCount > 0) && ' • '}
          {macbookCount > 0 && `${macbookCount}x MagSafe`}
          {macbookCount > 0 && windowsPCCount > 0 && ' • '}
          {windowsPCCount > 0 && `${windowsPCCount}x 65W AC`}
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
        <div className="mt-2 space-y-3">
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
            {windowsPCCount > 0 && (
              <li>
                <span className="font-bold">{windowsPCCount}x 65W AC Adapter</span>
                {windowsPCCount > 1 ? 's' : ''} (for Windows PC{windowsPCCount > 1 ? 's' : ''})
              </li>
            )}
          </ul>
          
          {requireAcknowledgment && (
            <div className="flex items-center space-x-2 pt-2 border-t border-amber-300 dark:border-amber-700">
              <Checkbox 
                id="chargers-acknowledged" 
                checked={acknowledged}
                onCheckedChange={(checked) => onAcknowledge?.(checked === true)}
              />
              <Label 
                htmlFor="chargers-acknowledged" 
                className="text-sm font-medium cursor-pointer text-amber-900 dark:text-amber-100"
              >
                I confirm chargers are included with this bundle
              </Label>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
