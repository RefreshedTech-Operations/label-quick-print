import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, RefreshCw } from 'lucide-react';

interface CarrierService {
  service_code: string;
  name: string;
  domestic: boolean;
  international: boolean;
}

interface Carrier {
  carrier_id: string;
  carrier_code: string;
  name: string;
  services: CarrierService[];
}

interface ShippingConfig {
  carrier: string;
  service_code: string;
  weight_oz: string;
  length_in: string;
  width_in: string;
  height_in: string;
  ship_from_name: string;
  ship_from_address: string;
  ship_from_city: string;
  ship_from_state: string;
  ship_from_zip: string;
  ship_from_country: string;
  ship_from_phone: string;
  api_key: string;
}

const DEFAULT_CONFIG: ShippingConfig = {
  carrier: '',
  service_code: '',
  weight_oz: '16',
  length_in: '10',
  width_in: '8',
  height_in: '4',
  ship_from_name: '',
  ship_from_address: '',
  ship_from_city: '',
  ship_from_state: '',
  ship_from_zip: '',
  ship_from_country: 'US',
  ship_from_phone: '',
  api_key: '',
};

export function ShippingSettingsTab() {
  const [config, setConfig] = useState<ShippingConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch carriers from ShipEngine
  const { data: carriers, isLoading: carriersLoading, refetch: refetchCarriers } = useQuery<Carrier[]>({
    queryKey: ['shipengine-carriers'],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipengine-carriers`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to fetch carriers');
      return payload.carriers || [];
    },
    staleTime: 10 * 60 * 1000, // cache 10 min
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .like('key', 'shipping_%');

    if (!error && data) {
      const loaded: Partial<ShippingConfig> = {};
      for (const row of data) {
        const field = row.key.replace('shipping_', '') as keyof ShippingConfig;
        if (field in DEFAULT_CONFIG) {
          loaded[field] = row.value || '';
        }
      }
      setConfig(prev => ({ ...prev, ...loaded }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(config).map(([key, value]) => ({
        key: `shipping_${key}`,
        value: String(value),
      }));

      for (const entry of entries) {
        const { error } = await supabase
          .from('app_config')
          .upsert(entry, { onConflict: 'key' });
        if (error) throw error;
      }

      toast.success('Shipping settings saved');
    } catch (err: any) {
      toast.error('Failed to save', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof ShippingConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const selectedCarrier = carriers?.find(c => c.carrier_id === config.carrier || c.carrier_code === config.carrier);
  const availableServices = selectedCarrier?.services || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ShipEngine API Key */}
      <Card>
        <CardHeader>
          <CardTitle>ShipEngine API Key</CardTitle>
          <CardDescription>Your ShipEngine API key used for label generation and carrier lookups</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-md">
            <Label>API Key</Label>
            <Input
              type="password"
              value={config.api_key}
              onChange={e => update('api_key', e.target.value)}
              placeholder="Enter your ShipEngine API key"
            />
            <p className="text-xs text-muted-foreground">
              Find your API key at{' '}
              <a href="https://app.shipengine.com/#/portal/apimanagement" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                ShipEngine Dashboard → API Management
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Carrier & Service */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Carrier & Service</CardTitle>
              <CardDescription>Select your carrier and shipping service from your ShipEngine account</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchCarriers()}
              disabled={carriersLoading}
              className="gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${carriersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Carrier</Label>
            {carriersLoading ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading carriers...
              </div>
            ) : carriers && carriers.length > 0 ? (
              <Select
                value={config.carrier}
                onValueChange={(v) => {
                  update('carrier', v);
                  const carrier = carriers.find(c => c.carrier_id === v || c.carrier_code === v);
                  const firstService = carrier?.services?.[0]?.service_code || '';
                  update('service_code', firstService);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select a carrier" /></SelectTrigger>
                <SelectContent>
                  {carriers.map(c => (
                    <SelectItem key={c.carrier_id} value={c.carrier_id}>
                      {c.name} ({c.carrier_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground p-2 rounded-md border border-dashed">
                No carriers found. Make sure your ShipEngine account has carriers configured.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Service</Label>
            {availableServices.length > 0 ? (
              <Select value={config.service_code} onValueChange={(v) => update('service_code', v)}>
                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {availableServices.map(s => (
                    <SelectItem key={s.service_code} value={s.service_code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground p-2 rounded-md border border-dashed">
                {config.carrier ? 'No services available for this carrier' : 'Select a carrier first'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Package Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Default Package</CardTitle>
          <CardDescription>Default weight and box dimensions for new labels</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Weight (oz)</Label>
            <Input type="number" value={config.weight_oz} onChange={e => update('weight_oz', e.target.value)} min="1" />
          </div>
          <div className="space-y-2">
            <Label>Length (in)</Label>
            <Input type="number" value={config.length_in} onChange={e => update('length_in', e.target.value)} min="1" />
          </div>
          <div className="space-y-2">
            <Label>Width (in)</Label>
            <Input type="number" value={config.width_in} onChange={e => update('width_in', e.target.value)} min="1" />
          </div>
          <div className="space-y-2">
            <Label>Height (in)</Label>
            <Input type="number" value={config.height_in} onChange={e => update('height_in', e.target.value)} min="1" />
          </div>
        </CardContent>
      </Card>

      {/* Ship From Address */}
      <Card>
        <CardHeader>
          <CardTitle>Ship From Address</CardTitle>
          <CardDescription>Return/origin address used on all generated labels</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name / Company</Label>
            <Input value={config.ship_from_name} onChange={e => update('ship_from_name', e.target.value)} placeholder="Shipping Dept" />
          </div>
          <div className="space-y-2">
            <Label>Street Address</Label>
            <Input value={config.ship_from_address} onChange={e => update('ship_from_address', e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={config.ship_from_city} onChange={e => update('ship_from_city', e.target.value)} placeholder="Austin" />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input value={config.ship_from_state} onChange={e => update('ship_from_state', e.target.value)} placeholder="TX" maxLength={2} />
          </div>
          <div className="space-y-2">
            <Label>ZIP Code</Label>
            <Input value={config.ship_from_zip} onChange={e => update('ship_from_zip', e.target.value)} placeholder="78701" />
          </div>
          <div className="space-y-2">
            <Label>Country Code</Label>
            <Input value={config.ship_from_country} onChange={e => update('ship_from_country', e.target.value)} placeholder="US" maxLength={2} />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input value={config.ship_from_phone} onChange={e => update('ship_from_phone', e.target.value)} placeholder="+1 555-123-4567" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Shipping Settings
        </Button>
      </div>
    </div>
  );
}
