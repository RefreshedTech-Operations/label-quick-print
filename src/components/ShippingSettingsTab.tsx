import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

const CARRIERS = [
  { value: 'usps', label: 'USPS' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl_express', label: 'DHL Express' },
];

const SERVICES: Record<string, { value: string; label: string }[]> = {
  usps: [
    { value: 'usps_priority_mail', label: 'Priority Mail' },
    { value: 'usps_priority_mail_express', label: 'Priority Mail Express' },
    { value: 'usps_first_class_mail', label: 'First Class Mail' },
    { value: 'usps_ground_advantage', label: 'Ground Advantage' },
    { value: 'usps_media_mail', label: 'Media Mail' },
  ],
  ups: [
    { value: 'ups_ground', label: 'Ground' },
    { value: 'ups_next_day_air', label: 'Next Day Air' },
    { value: 'ups_2nd_day_air', label: '2nd Day Air' },
    { value: 'ups_3_day_select', label: '3 Day Select' },
  ],
  fedex: [
    { value: 'fedex_ground', label: 'Ground' },
    { value: 'fedex_home_delivery', label: 'Home Delivery' },
    { value: 'fedex_express_saver', label: 'Express Saver' },
    { value: 'fedex_2day', label: '2Day' },
    { value: 'fedex_standard_overnight', label: 'Standard Overnight' },
  ],
  dhl_express: [
    { value: 'dhl_express_worldwide', label: 'Express Worldwide' },
  ],
};

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
}

const DEFAULT_CONFIG: ShippingConfig = {
  carrier: 'usps',
  service_code: 'usps_priority_mail',
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
};

export function ShippingSettingsTab() {
  const [config, setConfig] = useState<ShippingConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const availableServices = SERVICES[config.carrier] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Carrier & Service */}
      <Card>
        <CardHeader>
          <CardTitle>Carrier & Service</CardTitle>
          <CardDescription>Default carrier and shipping service for label generation</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Carrier</Label>
            <Select
              value={config.carrier}
              onValueChange={(v) => {
                update('carrier', v);
                const first = SERVICES[v]?.[0]?.value || '';
                update('service_code', first);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARRIERS.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Service</Label>
            <Select value={config.service_code} onValueChange={(v) => update('service_code', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableServices.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
