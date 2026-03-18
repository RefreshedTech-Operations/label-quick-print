import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Search, Truck, Tag, Loader2, ExternalLink, AlertTriangle, Package, XCircle, FileText, Pencil } from 'lucide-react';

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
  const hasName = parts.length >= 5;
  const [name, setName] = useState(hasName ? parts[0] : (shipment.buyer || ''));
  const [street, setStreet] = useState(hasName ? parts[1] : parts[0] || '');
  const [city, setCity] = useState(hasName ? parts[2] : parts[1] || '');
  const [state, setState] = useState(hasName ? parts[3] : '');
  const [zip, setZip] = useState(hasName ? parts[4] : '');
  const [country, setCountry] = useState(hasName && parts[5] ? parts[5] : (parts.length === 4 ? parts[3] : 'US'));
  const [saving, setSaving] = useState(false);

  // Parse legacy "State Zip" if needed
  useState(() => {
    if (!hasName && parts.length >= 3) {
      const stateZip = (parts[2] || '').split(' ');
      if (stateZip.length >= 2) {
        setState(stateZip[0]);
        setZip(stateZip.slice(1).join(' '));
        setCountry(parts[3] || 'US');
      }
    }
  });

  const handleSave = async () => {
    setSaving(true);
    const newAddress = [name, street, city, state, zip, country].join(', ');
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
            <Label htmlFor="addr-street">Street</Label>
            <Input id="addr-street" value={street} onChange={e => setStreet(e.target.value)} />
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
        </TabsList>
        <TabsContent value="missing" className="space-y-4 mt-4">
          <MissingLabelsTab queryClient={queryClient} />
        </TabsContent>
        <TabsContent value="generated" className="space-y-4 mt-4">
          <GeneratedLabelsTab queryClient={queryClient} />
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
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (selectedShowDate) query = query.eq('show_date', selectedShowDate);
      if (debouncedSearch) query = query.or(`order_id.ilike.%${debouncedSearch}%,uid.ilike.%${debouncedSearch}%,buyer.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,tracking.ilike.%${debouncedSearch}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return { shipments: data || [], total: count || 0 };
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
      let query = supabase.from('shipments').select('id').or('label_url.is.null,label_url.eq.empty').filter('label_url', 'is', null);
      if (selectedShowDate) query = query.eq('show_date', selectedShowDate);
      if (debouncedSearch) query = query.or(`order_id.ilike.%${debouncedSearch}%,uid.ilike.%${debouncedSearch}%,buyer.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,tracking.ilike.%${debouncedSearch}%`);
      const { data: allIds, error } = await query;
      if (error) throw error;
      setSelectedIds(new Set((allIds || []).map(r => r.id)));
      toast.success(`Selected ${allIds?.length || 0} orders`);
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
    for (const id of Array.from(selectedIds)) await handleGenerateLabel(id);
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
              <Input type="date" value={selectedShowDate || ''} onChange={(e) => { setSelectedShowDate(e.target.value || undefined); setPage(0); }} className="w-[160px]" />
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button onClick={handleBulkGenerate} size="sm" className="gap-2"><Tag className="h-4 w-4" />Generate {selectedIds.size} Label{selectedIds.size > 1 ? 's' : ''}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                </div>
              )}
            </div>
            {shipments.length > 0 && shipments.every(s => selectedIds.has(s.id)) && selectedIds.size < totalCount && (
              <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
                <span>All {shipments.length} on this page are selected.</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={handleSelectAllFiltered} disabled={isSelectingAll}>
                  {isSelectingAll ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Selecting...</> : <>Select all {totalCount} orders</>}
                </Button>
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-destructive p-1 rounded hover:bg-destructive/10 transition-colors">
                                <AlertTriangle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs text-xs bg-destructive text-destructive-foreground">
                              {rowErrors[s.id]}
                            </TooltipContent>
                          </Tooltip>
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
  const [voidingIds, setVoidingIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useAdaptiveDebounce(search, 600);

  const { data, isLoading } = useQuery({
    queryKey: ['shipping-labels-generated', debouncedSearch, selectedShowDate, page],
    queryFn: async () => {
      let query = supabase
        .from('shipments')
        .select('id, order_id, uid, buyer, product_name, address_full, tracking, show_date, label_url, manifest_url, created_at', { count: 'exact' })
        .not('label_url', 'is', null)
        .neq('label_url', '')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (selectedShowDate) query = query.eq('show_date', selectedShowDate);
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

  return (
    <>
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-lg px-3 py-1">{totalCount} generated</Badge>
      </div>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders, buyers, tracking..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Input type="date" value={selectedShowDate || ''} onChange={(e) => { setSelectedShowDate(e.target.value || undefined); setPage(0); }} className="w-[160px]" />
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
