import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAdaptiveDebounce } from '@/hooks/useAdaptiveDebounce';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ShowDateFilter } from '@/components/ShowDateFilter';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Search, Truck, Tag, Loader2, ExternalLink, AlertTriangle, Package, XCircle, FileText, Pencil, Download, Link } from 'lucide-react';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 25;

function PaginationBlock({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number | ((p: number) => number)) => void }) {
  if (totalPages <= 1) return null;
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
          />
        </PaginationItem>
        {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
          const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
          return (
            <PaginationItem key={pageNum}>
              <PaginationLink isActive={page === pageNum} onClick={() => setPage(pageNum)} className="cursor-pointer">
                {pageNum + 1}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        <PaginationItem>
          <PaginationNext
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            className={page >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

/* ─── Address Edit Dialog ─── */
function AddressEditDialog({
  open, onOpenChange, shipment, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shipment: { id: string; address_full: string | null; buyer: string | null };
  onSave: () => void;
}) {
  const parts = (shipment.address_full || '').split(',').map(s => s.trim());
  
  // Detect format based on part count
  // 7: Name, Street1, Street2, City, State, Zip, Country
  // 6: Name, Street1, City, State, Zip, Country (or Name, Street1, Street2, City, State, Zip)
  // 5: Name, Street1, City, State, Zip
  // 4: Street, City, State Zip, Country (legacy)
  const initFields = () => {
    if (parts.length >= 7) {
      return { name: parts[0], street: parts[1], street2: parts[2], city: parts[3], state: parts[4], zip: parts[5], country: parts[6] || 'US' };
    } else if (parts.length === 6) {
      // Heuristic: if last part looks like country code, no street2
      const last = parts[5].toLowerCase();
      const looksLikeCountry = last.length <= 3 || ['us','usa','united states','ca','canada','gb','uk','mx','mexico'].includes(last);
      if (looksLikeCountry) {
        return { name: parts[0], street: parts[1], street2: '', city: parts[2], state: parts[3], zip: parts[4], country: parts[5] };
      }
      return { name: parts[0], street: parts[1], street2: parts[2], city: parts[3], state: parts[4], zip: parts[5], country: 'US' };
    } else if (parts.length === 5) {
      return { name: parts[0], street: parts[1], street2: '', city: parts[2], state: parts[3], zip: parts[4], country: 'US' };
    } else {
      // Legacy: Street, City, State Zip, Country
      const stateZip = (parts[2] || '').split(' ');
      return { name: shipment.buyer || '', street: parts[0] || '', street2: '', city: parts[1] || '', state: stateZip[0] || '', zip: stateZip.slice(1).join(' ') || '', country: parts[3] || 'US' };
    }
  };
  const init = initFields();
  const [name, setName] = useState(init.name);
  const [street, setStreet] = useState(init.street);
  const [street2, setStreet2] = useState(init.street2);
  const [city, setCity] = useState(init.city);
  const [state, setState] = useState(init.state);
  const [zip, setZip] = useState(init.zip);
  const [country, setCountry] = useState(init.country);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const addressParts = [name, street, ...(street2 ? [street2] : []), city, state, zip, country];
    const newAddress = addressParts.join(', ');
    const { error } = await supabase.from('shipments').update({ address_full: newAddress }).eq('id', shipment.id);
    setSaving(false);
    if (error) { toast.error('Failed to update address'); return; }
    toast.success('Address updated');
    onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Shipping Address</DialogTitle>
          <DialogDescription>Update the address for this shipment.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="addr-name">Recipient Name</Label>
            <Input id="addr-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="addr-street">Street Address</Label>
            <Input id="addr-street" value={street} onChange={e => setStreet(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="addr-street2">Street Address 2 (Apt, Suite, etc.)</Label>
            <Input id="addr-street2" value={street2} onChange={e => setStreet2(e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="addr-city">City</Label>
              <Input id="addr-city" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="addr-state">State</Label>
              <Input id="addr-state" value={state} onChange={e => setState(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="addr-zip">ZIP Code</Label>
              <Input id="addr-zip" value={zip} onChange={e => setZip(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="addr-country">Country</Label>
              <Input id="addr-country" value={country} onChange={e => setCountry(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Service Override Popover ─── */
function ServiceOverridePopover({
  shipmentId,
  carriersData,
  overrides,
  setOverrides,
  defaultCarrierLabel,
  defaultServiceLabel,
}: {
  shipmentId: string;
  carriersData: any[];
  overrides: Record<string, { carrier_id: string; service_code: string }>;
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, { carrier_id: string; service_code: string }>>>;
  defaultCarrierLabel: string;
  defaultServiceLabel: string;
}) {
  const override = overrides[shipmentId];
  const hasOverride = !!override;
  const [selectedCarrierId, setSelectedCarrierId] = useState(override?.carrier_id || '');
  const [selectedServiceCode, setSelectedServiceCode] = useState(override?.service_code || '');

  const selectedCarrier = carriersData.find((c: any) => c.carrier_id === selectedCarrierId);
  const services = selectedCarrier?.services || [];

  const handleApply = () => {
    if (selectedCarrierId && selectedServiceCode) {
      setOverrides(prev => ({ ...prev, [shipmentId]: { carrier_id: selectedCarrierId, service_code: selectedServiceCode } }));
    }
  };

  const handleReset = () => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[shipmentId];
      return next;
    });
    setSelectedCarrierId('');
    setSelectedServiceCode('');
  };

  const displayCarrier = hasOverride
    ? (carriersData.find((c: any) => c.carrier_id === override.carrier_id)?.name || override.carrier_id)
    : defaultCarrierLabel;
  const displayService = hasOverride
    ? (carriersData.find((c: any) => c.carrier_id === override.carrier_id)?.services?.find((s: any) => s.service_code === override.service_code)?.name || override.service_code)
    : defaultServiceLabel;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`text-left text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors ${hasOverride ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}>
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{displayCarrier}</span>
            {hasOverride && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Custom</Badge>}
          </div>
          <span className="text-muted-foreground">{displayService}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="grid gap-3">
          <p className="text-sm font-medium">Override carrier & service</p>
          <div className="grid gap-1.5">
            <Label className="text-xs">Carrier</Label>
            <Select value={selectedCarrierId} onValueChange={(v) => { setSelectedCarrierId(v); setSelectedServiceCode(''); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select carrier" /></SelectTrigger>
              <SelectContent>
                {carriersData.map((c: any) => (
                  <SelectItem key={c.carrier_id} value={c.carrier_id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCarrierId && services.length > 0 && (
            <div className="grid gap-1.5">
              <Label className="text-xs">Service</Label>
              <Select value={selectedServiceCode} onValueChange={setSelectedServiceCode}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {services.map((s: any) => (
                    <SelectItem key={s.service_code} value={s.service_code} className="text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            {hasOverride && (
              <Button size="sm" variant="ghost" onClick={handleReset} className="h-7 text-xs">Reset to default</Button>
            )}
            <Button size="sm" onClick={handleApply} disabled={!selectedCarrierId || !selectedServiceCode} className="h-7 text-xs">Apply</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ShippingLabels() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('missing');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Shipping Labels
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and manage shipping labels via ShipEngine
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="missing" className="gap-2"><Tag className="h-4 w-4" />Missing Labels</TabsTrigger>
          <TabsTrigger value="generated" className="gap-2"><FileText className="h-4 w-4" />Generated Labels</TabsTrigger>
          <TabsTrigger value="lookup" className="gap-2"><Search className="h-4 w-4" />Label Lookup</TabsTrigger>
        </TabsList>
        <TabsContent value="missing" className="space-y-4 mt-4">
          <MissingLabelsTab queryClient={queryClient} />
        </TabsContent>
        <TabsContent value="generated" className="space-y-4 mt-4">
          <GeneratedLabelsTab queryClient={queryClient} />
        </TabsContent>
        <TabsContent value="lookup" className="space-y-4 mt-4">
          <LabelLookupTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Missing Labels Tab ─── */
function MissingLabelsTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedShowDate, setSelectedShowDate] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [serviceOverrides, setServiceOverrides] = useState<Record<string, { carrier_id: string; service_code: string }>>({});
  const [editingAddress, setEditingAddress] = useState<{ id: string; address_full: string | null; buyer: string | null } | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; succeeded: number; failed: number } | null>(null);

  const debouncedSearch = useAdaptiveDebounce(search, 600);

  const { data: shippingConfig } = useQuery({
    queryKey: ['shipping-config'],
    queryFn: async () => {
      const { data } = await supabase.from('app_config').select('key, value').in('key', ['shipping_carrier', 'shipping_service_code']);
      const cfg: Record<string, string> = {};
      for (const row of data || []) cfg[row.key.replace('shipping_', '')] = row.value || '';
      return cfg;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: carriersData } = useQuery({
    queryKey: ['shipengine-carriers'],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return [];
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipengine-carriers`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const payload = await response.json();
      return payload.carriers || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const carriers = carriersData || [];
  const selectedCarrier = carriers.find((c: any) => c.carrier_id === shippingConfig?.carrier || c.carrier_code === shippingConfig?.carrier);
  const carrierLabel = selectedCarrier?.name || shippingConfig?.carrier || '—';
  const selectedService = (selectedCarrier?.services || []).find((s: any) => s.service_code === shippingConfig?.service_code);
  const serviceLabel = selectedService?.name || shippingConfig?.service_code || '—';

  const { data, isLoading } = useQuery({
    queryKey: ['shipping-labels-missing', debouncedSearch, selectedShowDate, page],
    queryFn: async () => {
      let query = supabase
        .from('shipments')
        .select('id, order_id, uid, buyer, product_name, address_full, tracking, show_date, label_url, created_at', { count: 'exact' })
        .or('label_url.is.null,label_url.eq.')
        .or('tracking.is.null,tracking.eq.')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (selectedShowDate) query = query.eq('show_date', selectedShowDate);
      if (debouncedSearch) query = query.or(`order_id.ilike.%${debouncedSearch}%,uid.ilike.%${debouncedSearch}%,buyer.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,tracking.ilike.%${debouncedSearch}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return { shipments: data || [], total: count || 0 };
    },
  });

  const { data: recentDatesData } = useQuery({
    queryKey: ['missing-labels-recent-dates'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_missing_label_date_counts', { limit_rows: 5 });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        date: d.show_date,
        count: d.total_count,
        unprintedCount: d.missing_count,
      }));
    },
  });

  const shipments = data?.shipments || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSelectPage = useCallback(() => {
    if (selectedIds.size === shipments.length && shipments.every(s => selectedIds.has(s.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shipments.map(s => s.id)));
    }
  }, [shipments, selectedIds]);

  const handleSelectAllFiltered = useCallback(async () => {
    setIsSelectingAll(true);
    try {
      const allIds: { id: string }[] = [];
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        let query = supabase.from('shipments').select('id').or('label_url.is.null,label_url.eq.').range(offset, offset + batchSize - 1);
        if (selectedShowDate) query = query.eq('show_date', selectedShowDate);
        if (debouncedSearch) query = query.or(`order_id.ilike.%${debouncedSearch}%,uid.ilike.%${debouncedSearch}%,buyer.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,tracking.ilike.%${debouncedSearch}%`);
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allIds.push(...data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      setSelectedIds(new Set(allIds.map(r => r.id)));
      toast.success(`Selected ${allIds.length} orders`);
    } catch { toast.error('Failed to select all orders'); }
    finally { setIsSelectingAll(false); }
  }, [selectedShowDate, debouncedSearch]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const formatFunctionError = (payload: any, fallback: string) => {
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      return payload.errors.map((e: any) => {
        const details = [e?.field ? `field: ${e.field}` : null, e?.code ? `code: ${e.code}` : null, e?.type ? `type: ${e.type}` : null].filter(Boolean).join(', ');
        return details ? `${e?.message || 'Unknown error'} (${details})` : (e?.message || 'Unknown error');
      }).join(' | ');
    }
    return payload?.error || payload?.message || fallback;
  };

  const handleGenerateLabel = useCallback(async (shipmentId: string) => {
    setGeneratingIds(prev => new Set(prev).add(shipmentId));
    setRowErrors(prev => { const next = { ...prev }; delete next[shipmentId]; return next; });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No active session. Please sign in again.');

      const override = serviceOverrides[shipmentId];
      const body: any = { shipment_id: shipmentId };
      if (override) {
        body.override_carrier_id = override.carrier_id;
        body.override_service_code = override.service_code;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipengine-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify(body),
      });
      const raw = await response.text();
      let payload: any = {};
      if (raw) { try { payload = JSON.parse(raw); } catch { payload = { error: raw }; } }
      if (!response.ok) throw new Error(formatFunctionError(payload, `Label generation failed (${response.status})`));
      if (payload?.error) throw new Error(formatFunctionError(payload, payload.error));
      toast.success('Shipping label generated successfully');
      queryClient.invalidateQueries({ queryKey: ['shipping-labels-missing'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-labels-generated'] });
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate label';
      setRowErrors(prev => ({ ...prev, [shipmentId]: msg }));
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(shipmentId); return next; });
    }
  }, [queryClient, serviceOverrides]);

  const handleBulkGenerate = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const total = ids.length;
    let succeeded = 0;
    let failed = 0;
    const BATCH_SIZE = 3;
    setBulkProgress({ current: 0, total, succeeded: 0, failed: 0 });

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(id => handleGenerateLabel(id)));

      results.forEach((_, idx) => {
        const id = batch[idx];
        setRowErrors(prev => {
          if (prev[id]) { failed++; } else { succeeded++; }
          return prev;
        });
      });

      const processed = Math.min(i + batch.length, total);
      setBulkProgress({ current: processed, total, succeeded, failed });
    }

    setBulkProgress(null);
    toast.success(`Label generation complete: ${succeeded} succeeded, ${failed} failed`);
    setSelectedIds(new Set());
  }, [selectedIds, handleGenerateLabel]);

  return (
    <TooltipProvider>
      <>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-lg px-3 py-1">{totalCount} missing</Badge>
        </div>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders, buyers, tracking..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
              </div>
              {selectedIds.size > 0 && !bulkProgress && (
                <div className="flex items-center gap-2">
                  <Button onClick={handleBulkGenerate} size="sm" className="gap-2"><Tag className="h-4 w-4" />Generate {selectedIds.size} Label{selectedIds.size > 1 ? 's' : ''}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                </div>
              )}
            </div>
            <div className="mt-2">
              <ShowDateFilter
                selectedDate={selectedShowDate}
                recentDates={recentDatesData || []}
                onDateSelect={(date) => { setSelectedShowDate(date); setPage(0); }}
              />
            </div>
            {shipments.length > 0 && shipments.every(s => selectedIds.has(s.id)) && selectedIds.size < totalCount && (
              <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
                <span>All {shipments.length} on this page are selected.</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={handleSelectAllFiltered} disabled={isSelectingAll}>
                  {isSelectingAll ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Selecting...</> : <>Select all {totalCount} orders</>}
                </Button>
              </div>
            )}
            {bulkProgress && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium">Generating labels...</span>
                  </div>
                  <span className="text-muted-foreground">
                    {bulkProgress.current} / {bulkProgress.total}
                    {bulkProgress.failed > 0 && <span className="text-destructive ml-2">({bulkProgress.failed} failed)</span>}
                  </span>
                </div>
                <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={shipments.length > 0 && shipments.every(s => selectedIds.has(s.id))} onCheckedChange={handleSelectPage} /></TableHead>
                  <TableHead className="w-[15%]">Order</TableHead>
                  <TableHead className="w-[12%]">Buyer</TableHead>
                  <TableHead className="w-[15%]">Product</TableHead>
                  <TableHead className="w-[22%]">Address</TableHead>
                  <TableHead className="w-[8%]">Show Date</TableHead>
                  <TableHead className="w-[13%]">Service</TableHead>
                  <TableHead className="w-[15%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : shipments.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No shipments missing labels</TableCell></TableRow>
                ) : shipments.map((s) => (
                  <TableRow key={s.id} className={rowErrors[s.id] ? 'bg-destructive/5' : ''}>
                    <TableCell><Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></TableCell>
                    <TableCell className="font-mono text-xs truncate">
                      <div className="truncate">{s.order_id}</div>
                      {s.uid && <div className="text-muted-foreground truncate">{s.uid}</div>}
                    </TableCell>
                    <TableCell className="text-xs truncate">{s.buyer || '—'}</TableCell>
                    <TableCell className="text-xs truncate">{s.product_name || '—'}</TableCell>
                    <TableCell>
                      <button
                        className="text-left text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors flex items-center gap-1 group w-full"
                        onClick={() => setEditingAddress({ id: s.id, address_full: s.address_full, buyer: s.buyer })}
                      >
                        <span className="truncate">{s.address_full || '—'}</span>
                        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                      </button>
                    </TableCell>
                    <TableCell className="text-xs">{s.show_date || '—'}</TableCell>
                    <TableCell>
                      <ServiceOverridePopover
                        shipmentId={s.id}
                        carriersData={carriers}
                        overrides={serviceOverrides}
                        setOverrides={setServiceOverrides}
                        defaultCarrierLabel={carrierLabel}
                        defaultServiceLabel={serviceLabel}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" disabled={generatingIds.has(s.id)} onClick={() => handleGenerateLabel(s.id)} className="gap-1">
                          {generatingIds.has(s.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}Generate
                        </Button>
                        {rowErrors[s.id] && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-destructive p-1 rounded hover:bg-destructive/10 transition-colors">
                                <AlertTriangle className="h-4 w-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="left" className="max-w-xs text-xs bg-destructive text-destructive-foreground">
                              {rowErrors[s.id]}
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <PaginationBlock page={page} totalPages={totalPages} setPage={setPage} />

        {editingAddress && (
          <AddressEditDialog
            open={!!editingAddress}
            onOpenChange={(o) => { if (!o) setEditingAddress(null); }}
            shipment={editingAddress}
            onSave={() => queryClient.invalidateQueries({ queryKey: ['shipping-labels-missing'] })}
          />
        )}
      </>
    </TooltipProvider>
  );
}

/* ─── Generated Labels Tab ─── */
function GeneratedLabelsTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedShowDate, setSelectedShowDate] = useState<string | undefined>();
  const [allShowsMode, setAllShowsMode] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string | undefined>();

  // Compute the "last 5 days" cutoff date string
  const last5DaysDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    return d.toISOString().slice(0, 10);
  })();
  const [voidingIds, setVoidingIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useAdaptiveDebounce(search, 600);

  // Fetch recent show dates for generated labels (filtered by channel)
  const { data: recentDates } = useQuery({
    queryKey: ['shipping-labels-generated-show-dates', channelFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_generated_label_date_counts', {
        p_channel: channelFilter || null,
      });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        date: d.show_date,
        count: d.count,
        unprintedCount: d.count,
      }));
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['shipping-labels-generated', debouncedSearch, selectedShowDate, allShowsMode, channelFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('shipments')
        .select('id, order_id, uid, buyer, product_name, address_full, tracking, show_date, label_url, manifest_url, created_at, channel', { count: 'exact' })
        .not('label_url', 'is', null)
        .neq('label_url', '')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (selectedShowDate) query = query.eq('show_date', selectedShowDate);
      else if (!allShowsMode) query = query.gte('show_date', last5DaysDate);
      if (channelFilter) query = query.eq('channel', channelFilter);
      if (debouncedSearch) query = query.or(`order_id.ilike.%${debouncedSearch}%,uid.ilike.%${debouncedSearch}%,buyer.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,tracking.ilike.%${debouncedSearch}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return { shipments: data || [], total: count || 0 };
    },
  });

  const shipments = data?.shipments || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleVoidLabel = useCallback(async (shipmentId: string) => {
    setVoidingIds(prev => new Set(prev).add(shipmentId));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No active session.');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipengine-void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ shipment_id: shipmentId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Void failed');
      toast.success('Label voided and cleared');
      queryClient.invalidateQueries({ queryKey: ['shipping-labels-generated'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-labels-missing'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to void label');
    } finally {
      setVoidingIds(prev => { const next = new Set(prev); next.delete(shipmentId); return next; });
    }
  }, [queryClient]);

  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const handleBackfillCosts = useCallback(async () => {
    setBackfilling(true);
    let totalUpdated = 0;
    let stalledPasses = 0;
    let pass = 0;
    const maxPasses = 30;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Not authenticated'); return; }

      const requestBody = {
        showDate: selectedShowDate,
        minShowDate: !selectedShowDate && !allShowsMode ? last5DaysDate : undefined,
        channel: channelFilter,
      };

      let hasMore = true;
      while (hasMore && pass < maxPasses) {
        pass++;
        const res = await supabase.functions.invoke('shipengine-backfill-costs', { body: requestBody });
        if (res.error) throw new Error(res.error.message);
        const result = (res.data || {}) as {
          updated?: number;
          remaining?: number;
          hasMore?: boolean;
          errors?: string[];
        };

        const updatedThisPass = Number(result.updated || 0);
        totalUpdated += updatedThisPass;
        stalledPasses = updatedThisPass === 0 ? stalledPasses + 1 : 0;

        if (result.errors?.length) {
          console.warn('Backfill errors:', result.errors);
        }

        const hasMoreFromServer = typeof result.hasMore === 'boolean'
          ? result.hasMore
          : Number(result.remaining || 0) > 0;

        hasMore = hasMoreFromServer && stalledPasses < 2;

        if (hasMore) {
          if (typeof result.remaining === 'number') {
            toast.info(`Backfilled ${totalUpdated} so far, ${result.remaining} remaining...`);
          } else {
            toast.info(`Backfilled ${totalUpdated} so far, continuing...`);
          }
        }
      }

      if (totalUpdated > 0) {
        toast.success(`Backfill complete! Updated ${totalUpdated} labels with costs.`);
      } else {
        toast.warning('No shipping costs were found for the current filter.');
      }

      queryClient.invalidateQueries({ queryKey: ['shipping-labels-generated'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-labels-generated-show-dates'] });
    } catch (err: any) {
      toast.error(err?.message || 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  }, [queryClient, selectedShowDate, allShowsMode, channelFilter, last5DaysDate]);

  const runExport = useCallback(async (format: 'full' | 'tiktok') => {
    setExporting(true);
    setExportDialogOpen(false);
    try {
      let query = supabase
        .from('shipments')
        .select('order_id, uid, buyer, product_name, address_full, tracking, show_date, label_url, channel, created_at, shipping_provider, shipping_cost')
        .not('label_url', 'is', null)
        .neq('label_url', '')
        .order('created_at', { ascending: false })
        .limit(50000);
      if (selectedShowDate) query = query.eq('show_date', selectedShowDate);
      else if (!allShowsMode) query = query.gte('show_date', last5DaysDate);
      if (channelFilter) query = query.eq('channel', channelFilter);
      if (debouncedSearch) query = query.or(`order_id.ilike.%${debouncedSearch}%,uid.ilike.%${debouncedSearch}%,buyer.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,tracking.ilike.%${debouncedSearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) { toast.error('No data to export'); return; }

      if (format === 'tiktok') {
        const carrierNameMap: Record<string, string> = {
          'usps': 'USPS',
          'ups': 'UPS',
          'fedex': 'FedEx',
          'dhl': 'DHL',
          'dhl_express': 'DHL Express',
        };
        const tiktokData = data.map((r: any) => {
          const provider = (r.shipping_provider || '').toLowerCase();
          return {
            'Order ID': r.order_id,
            'Tracking ID': r.tracking || '',
            'Shipping Provider Name': carrierNameMap[provider] || r.shipping_provider || 'Other',
          };
        });
        const ws = XLSX.utils.json_to_sheet(tiktokData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TikTok Tracking Upload');
        XLSX.writeFile(wb, `tiktok-tracking-upload-${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Generated Labels');
        XLSX.writeFile(wb, `generated-labels-${new Date().toISOString().slice(0, 10)}.xlsx`);
      }
      toast.success(`Exported ${data.length} records`);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [selectedShowDate, allShowsMode, channelFilter, debouncedSearch, last5DaysDate]);

  return (
    <>
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-lg px-3 py-1">{totalCount} generated</Badge>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBackfillCosts} disabled={backfilling} className="gap-1">
            {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
            Backfill Costs
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)} disabled={exporting} className="gap-1">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
        </div>
      </div>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Format</DialogTitle>
            <DialogDescription>Choose how you'd like to export the filtered results.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => runExport('full')}>
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium">Full Export</div>
                <div className="text-xs text-muted-foreground">All columns (order, buyer, tracking, etc.)</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => runExport('tiktok')}>
              <Package className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium">TikTok Tracking Upload</div>
                <div className="text-xs text-muted-foreground">Order ID, Tracking Number, Shipping Provider</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders, buyers, tracking..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={channelFilter || 'all'} onValueChange={(v) => { setChannelFilter(v === 'all' ? undefined : v); setPage(0); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="misfits">Misfits</SelectItem>
                <SelectItem value="outlet">Outlet</SelectItem>
              </SelectContent>
            </Select>
            <ShowDateFilter
              selectedDate={selectedShowDate}
              recentDates={recentDates || []}
              onDateSelect={(date) => { setSelectedShowDate(date); if (date) setAllShowsMode(false); setPage(0); }}
              onAllShowsEnable={() => setAllShowsMode(true)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Order</TableHead>
                <TableHead className="w-[14%]">Buyer</TableHead>
                <TableHead className="w-[18%]">Product</TableHead>
                <TableHead className="w-[14%]">Tracking</TableHead>
                <TableHead className="w-[10%]">Show Date</TableHead>
                <TableHead className="w-[8%]">Label</TableHead>
                <TableHead className="w-[18%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              )) : shipments.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No generated labels yet</TableCell></TableRow>
              ) : shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">
                    <div className="truncate">{s.order_id}</div>
                    {s.uid && <div className="text-muted-foreground truncate">{s.uid}</div>}
                  </TableCell>
                  <TableCell className="text-xs truncate">{s.buyer || '—'}</TableCell>
                  <TableCell className="text-xs truncate">{s.product_name || '—'}</TableCell>
                  <TableCell className="font-mono text-xs truncate">{s.tracking || '—'}</TableCell>
                  <TableCell className="text-xs">{s.show_date || '—'}</TableCell>
                  <TableCell>
                    <a
                      href="#"
                      className="text-primary hover:underline text-xs flex items-center gap-1"
                      onClick={async (e) => {
                        e.preventDefault();
                        const { data: sessionData } = await supabase.auth.getSession();
                        const accessToken = sessionData?.session?.access_token;
                        if (!accessToken) { toast.error('No active session'); return; }
                        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipengine-label-download?url=${encodeURIComponent(s.label_url)}`;
                        const res = await fetch(proxyUrl, {
                          headers: { Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
                        });
                        if (!res.ok) { toast.error('Failed to download label'); return; }
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />View
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" disabled={voidingIds.has(s.id)} className="gap-1">
                          {voidingIds.has(s.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                          Void
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Void this label?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will void the label with ShipEngine and clear the label &amp; manifest URLs on order <span className="font-mono font-bold">{s.order_id}</span>. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleVoidLabel(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Void Label
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PaginationBlock page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}

/* ─── Label Lookup Tab ─── */
function LabelLookupTab() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'tracking' | 'order_id'>('tracking');
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; label: any | null }>({ open: false, label: null });
  const [linkOrderId, setLinkOrderId] = useState('');
  const [linking, setLinking] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { setError('Not authenticated'); setLoading(false); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipengine-label-lookup?query=${encodeURIComponent(query.trim())}&search_type=${searchType}`,
        { headers: { Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Search failed'); setLoading(false); return; }
      setResults(data.labels || []);
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (pdfUrl: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error('Not authenticated'); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipengine-label-download?url=${encodeURIComponent(pdfUrl)}`,
        { headers: { Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) { toast.error('Failed to download label'); return; }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `label.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      toast.error('Failed to download label');
    }
  };

  const handleLinkToOrder = async () => {
    if (!linkOrderId.trim() || !linkDialog.label) return;
    setLinking(true);
    try {
      const label = linkDialog.label;
      const pdfUrl = label.label_download?.pdf || label.label_download?.href || null;

      // Find shipments matching this order_id
      const { data: shipments, error: fetchErr } = await supabase
        .from('shipments')
        .select('id')
        .eq('order_id', linkOrderId.trim())
        .limit(100);

      if (fetchErr) throw fetchErr;
      if (!shipments || shipments.length === 0) {
        toast.error(`No shipments found for order "${linkOrderId.trim()}"`);
        setLinking(false);
        return;
      }

      const ids = shipments.map(s => s.id);
      const { error: updateErr } = await supabase
        .from('shipments')
        .update({
          tracking: label.tracking_number || null,
          label_url: pdfUrl,
          manifest_url: pdfUrl,
          shipengine_label_id: label.label_id || null,
          shipping_provider: label.carrier_code || null,
          shipping_cost: label.shipment_cost?.amount != null ? Number(label.shipment_cost.amount) : null,
        })
        .in('id', ids);

      if (updateErr) throw updateErr;

      toast.success(`Linked label to ${shipments.length} shipment(s) for order "${linkOrderId.trim()}"`);
      setLinkDialog({ open: false, label: null });
      setLinkOrderId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to link label');
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={searchType} onValueChange={(v: 'tracking' | 'order_id') => setSearchType(v)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tracking">Tracking Number</SelectItem>
                <SelectItem value="order_id">Order ID</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1 flex gap-2">
              <Input
                placeholder={searchType === 'tracking' ? 'Enter tracking number...' : 'Enter order ID...'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {results !== null && results.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            No labels found for this search.
          </CardContent>
        </Card>
      )}

      {results && results.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label ID</TableHead>
                  <TableHead>Tracking #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Carrier / Service</TableHead>
                  <TableHead>Ship Date</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((label: any) => {
                  const pdfUrl = label.label_download?.pdf || label.label_download?.href;
                  const shipTo = label.ship_to || {};
                  const recipient = [shipTo.name, shipTo.city_locality, shipTo.state_province].filter(Boolean).join(', ');
                  const cost = label.shipment_cost?.amount != null
                    ? `$${Number(label.shipment_cost.amount).toFixed(2)}`
                    : '—';

                  return (
                    <TableRow key={label.label_id}>
                      <TableCell className="font-mono text-xs">{label.label_id?.slice(0, 12)}...</TableCell>
                      <TableCell className="font-mono text-xs">{label.tracking_number || '—'}</TableCell>
                      <TableCell>
                        {label.voided ? (
                          <Badge variant="destructive">Voided</Badge>
                        ) : (
                          <Badge variant="secondary">{label.status || 'unknown'}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{label.carrier_code || '—'}</div>
                        <div className="text-muted-foreground">{label.service_code || ''}</div>
                      </TableCell>
                      <TableCell className="text-xs">{label.ship_date || '—'}</TableCell>
                      <TableCell className="text-xs">{cost}</TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate">{recipient || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {pdfUrl && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" onClick={() => handleDownloadPdf(pdfUrl)}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download PDF</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {!label.voided && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" onClick={() => { setLinkDialog({ open: true, label }); setLinkOrderId(''); }}>
                                    <Link className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Link to Order</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={linkDialog.open} onOpenChange={(open) => { if (!open) setLinkDialog({ open: false, label: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Label to Order</DialogTitle>
            <DialogDescription>
              Enter the order number to attach this label's tracking, PDF, cost, and carrier data to the matching shipment(s).
              {linkDialog.label && (
                <span className="block mt-2 font-mono text-xs text-foreground">
                  Label: {linkDialog.label.label_id} — {linkDialog.label.tracking_number || 'No tracking'}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="link-order-id">Order Number</Label>
              <Input
                id="link-order-id"
                placeholder="Enter order number..."
                value={linkOrderId}
                onChange={e => setLinkOrderId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLinkToOrder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog({ open: false, label: null })}>Cancel</Button>
            <Button onClick={handleLinkToOrder} disabled={linking || !linkOrderId.trim()}>
              {linking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Link to Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
