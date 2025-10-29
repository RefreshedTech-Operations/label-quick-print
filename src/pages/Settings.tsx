import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { fetchPrinters, PrintNodePrinter } from '@/lib/printnode';
import { Loader2 } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings } = useAppStore();
  const [apiKey, setApiKey] = useState(settings.printnode_api_key || '');
  const [printers, setPrinters] = useState<PrintNodePrinter[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLoadPrinters = async () => {
    if (!apiKey) {
      toast.error('Please enter PrintNode API key');
      return;
    }

    setLoading(true);
    try {
      const fetchedPrinters = await fetchPrinters(apiKey);
      setPrinters(fetchedPrinters);
      updateSettings({ printnode_api_key: apiKey });
      toast.success(`Loaded ${fetchedPrinters.length} printers`);
    } catch (error: any) {
      toast.error('Failed to load printers', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrinter = (printerId: string) => {
    updateSettings({ printer_id: printerId });
    toast.success('Printer saved');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure PrintNode and scanning options</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PrintNode Configuration</CardTitle>
          <CardDescription>Set up your PrintNode API key and select a printer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">PrintNode API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your PrintNode API key"
            />
          </div>

          <Button onClick={handleLoadPrinters} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Load Printers
          </Button>

          {printers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="printer">Select Printer</Label>
              <Select
                value={settings.printer_id}
                onValueChange={handleSavePrinter}
              >
                <SelectTrigger id="printer">
                  <SelectValue placeholder="Choose a printer" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id.toString()}>
                      {printer.name} {printer.state === 'offline' && '(Offline)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scanning Options</CardTitle>
          <CardDescription>Configure how the app handles scanned UIDs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-print on scan</Label>
              <p className="text-sm text-muted-foreground">
                Automatically print labels when a UID is scanned
              </p>
            </div>
            <Switch
              checked={settings.auto_print}
              onCheckedChange={(checked) => updateSettings({ auto_print: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>UID fallback from product description</Label>
              <p className="text-sm text-muted-foreground">
                Extract UID from product description if SKU is empty
              </p>
            </div>
            <Switch
              checked={settings.fallback_uid_from_description}
              onCheckedChange={(checked) =>
                updateSettings({ fallback_uid_from_description: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Block cancelled orders</Label>
              <p className="text-sm text-muted-foreground">
                Prevent printing labels for cancelled or failed orders
              </p>
            </div>
            <Switch
              checked={settings.block_cancelled}
              onCheckedChange={(checked) => updateSettings({ block_cancelled: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
