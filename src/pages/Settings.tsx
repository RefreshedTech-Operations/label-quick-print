import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Settings() {
  const { settings, updateSettings } = useAppStore();
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const [defaultPrinterId, setDefaultPrinterId] = useState(settings.default_printer_id || '');
  const [loading, setLoading] = useState(false);
  const [appConfigId, setAppConfigId] = useState<string>('');

  useEffect(() => {
    loadSettings();
    loadAppConfig();
  }, []);

  const loadAppConfig = async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('key', 'printnode_api_key')
      .maybeSingle();

    if (error) {
      console.error('Failed to load app config:', error);
      return;
    }

    if (data) {
      setPrintnodeApiKey(data.value || '');
      setAppConfigId(data.id);
    }
  };

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load settings:', error);
      return;
    }

    if (data) {
      updateSettings({
        default_printer_id: data.default_printer_id,
        auto_print: data.auto_print,
        fallback_uid_from_description: data.fallback_uid_from_description,
        block_cancelled: data.block_cancelled
      });
      setDefaultPrinterId(data.default_printer_id || '');
    }
  };

  const handleSaveSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    try {
      // Save app config (PrintNode API key)
      if (appConfigId) {
        const { error: configError } = await supabase
          .from('app_config')
          .update({ value: printnodeApiKey })
          .eq('id', appConfigId);

        if (configError) throw configError;
      } else {
        // Insert if doesn't exist
        const { error: configError } = await supabase
          .from('app_config')
          .upsert({ 
            key: 'printnode_api_key', 
            value: printnodeApiKey 
          }, {
            onConflict: 'key'
          });

        if (configError) throw configError;
      }

      // Save user settings (printer ID)
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          default_printer_id: defaultPrinterId,
          auto_print: settings.auto_print,
          fallback_uid_from_description: settings.fallback_uid_from_description,
          block_cancelled: settings.block_cancelled
        }, {
          onConflict: 'user_id'
        });

      if (settingsError) throw settingsError;

      updateSettings({ 
        default_printer_id: defaultPrinterId 
      });
      toast.success('Settings saved');
    } catch (error: any) {
      toast.error('Failed to save settings', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: keyof typeof settings, value: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          [key]: value,
          default_printer_id: defaultPrinterId,
          auto_print: settings.auto_print,
          fallback_uid_from_description: settings.fallback_uid_from_description,
          block_cancelled: settings.block_cancelled
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      updateSettings({ [key]: value });
      toast.success('Setting updated');
    } catch (error: any) {
      toast.error('Failed to update setting', {
        description: error.message
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure printer and scanning options</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PrintNode Configuration</CardTitle>
          <CardDescription>Configure PrintNode API key (shared across all users) and your default printer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">PrintNode API Key (App-wide)</Label>
            <Input
              id="api-key"
              type="password"
              value={printnodeApiKey}
              onChange={(e) => setPrintnodeApiKey(e.target.value)}
              placeholder="Enter PrintNode API key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="printer-id">Default Printer ID</Label>
            <Input
              id="printer-id"
              type="number"
              value={defaultPrinterId}
              onChange={(e) => setDefaultPrinterId(e.target.value)}
              placeholder="Enter PrintNode printer ID"
            />
          </div>

          <Button onClick={handleSaveSettings} disabled={loading}>
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
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
              onCheckedChange={(checked) => handleUpdateSetting('auto_print', checked)}
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
                handleUpdateSetting('fallback_uid_from_description', checked)
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
              onCheckedChange={(checked) => handleUpdateSetting('block_cancelled', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
