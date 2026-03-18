import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdaptiveDebounce } from '@/hooks/useAdaptiveDebounce';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { toast } from 'sonner';
import { Search, Truck, Tag, Loader2, ExternalLink, AlertCircle, Package } from 'lucide-react';

const PAGE_SIZE = 25;

const CARRIER_LABELS: Record<string, string> = {
  usps: 'USPS', ups: 'UPS', fedex: 'FedEx', dhl_express: 'DHL',
};
const SERVICE_LABELS: Record<string, string> = {
  usps_priority_mail: 'Priority Mail', usps_priority_mail_express: 'Priority Express',
  usps_first_class_mail: 'First Class', usps_ground_advantage: 'Ground Advantage', usps_media_mail: 'Media Mail',
  ups_ground: 'Ground', ups_next_day_air: 'Next Day Air', ups_2nd_day_air: '2nd Day Air', ups_3_day_select: '3 Day Select',
  fedex_ground: 'Ground', fedex_home_delivery: 'Home Delivery', fedex_express_saver: 'Express Saver',
  fedex_2day: '2Day', fedex_standard_overnight: 'Std Overnight',
  dhl_express_worldwide: 'Express Worldwide',
};

export default function ShippingLabels() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedShowDate, setSelectedShowDate] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const debouncedSearch = useAdaptiveDebounce(search, 600);

  // Fetch default shipping config (carrier + service)
  const { data: shippingConfig } = useQuery({
    queryKey: ['shipping-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['shipping_carrier', 'shipping_service_code']);
      const cfg: Record<string, string> = {};
      for (const row of data || []) cfg[row.key.replace('shipping_', '')] = row.value || '';
      return cfg;
    },
    staleTime: 5 * 60 * 1000,
  });

  const carrierLabel = CARRIER_LABELS[shippingConfig?.carrier || 'usps'] || shippingConfig?.carrier || 'USPS';
  const serviceLabel = SERVICE_LABELS[shippingConfig?.service_code || 'usps_priority_mail'] || shippingConfig?.service_code || 'Priority Mail';

  // Query shipments where label_url is null or empty
  const { data, isLoading } = useQuery({
    queryKey: ['shipping-labels', debouncedSearch, selectedShowDate, page],
    queryFn: async () => {
      let query = supabase
        .from('shipments')
        .select('id, order_id, uid, buyer, product_name, address_full, tracking, show_date, label_url, created_at', { count: 'exact' })
        .or('label_url.is.null,label_url.eq.')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedShowDate) {
        query = query.eq('show_date', selectedShowDate);
      }

      if (debouncedSearch) {
        query = query.or(
          `order_id.ilike.%${debouncedSearch}%,uid.ilike.%${debouncedSearch}%,buyer.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,tracking.ilike.%${debouncedSearch}%`
        );
      }

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

  const [isSelectingAll, setIsSelectingAll] = useState(false);

  const handleSelectAllFiltered = useCallback(async () => {
    setIsSelectingAll(true);
    try {
      let query = supabase
        .from('shipments')
        .select('id')
        .or('label_url.is.null,label_url.eq.');

      if (selectedShowDate) {
        query = query.eq('show_date', selectedShowDate);
      }
      if (debouncedSearch) {
        query = query.or(
          `order_id.ilike.%${debouncedSearch}%,uid.ilike.%${debouncedSearch}%,buyer.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,tracking.ilike.%${debouncedSearch}%`
        );
      }

      const { data: allIds, error } = await query;
      if (error) throw error;
      setSelectedIds(new Set((allIds || []).map(r => r.id)));
      toast.success(`Selected ${allIds?.length || 0} orders`);
    } catch (err: any) {
      toast.error('Failed to select all orders');
    } finally {
      setIsSelectingAll(false);
    }
  }, [selectedShowDate, debouncedSearch]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const formatFunctionError = (payload: any, fallback: string) => {
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      return payload.errors
        .map((e: any) => {
          const details = [
            e?.field ? `field: ${e.field}` : null,
            e?.code ? `code: ${e.code}` : null,
            e?.type ? `type: ${e.type}` : null,
          ].filter(Boolean).join(', ');
          return details ? `${e?.message || 'Unknown error'} (${details})` : (e?.message || 'Unknown error');
        })
        .join(' | ');
    }

    return payload?.error || payload?.message || fallback;
  };

  const handleGenerateLabel = useCallback(async (shipmentId: string) => {
    setGeneratingIds(prev => new Set(prev).add(shipmentId));
    setRowErrors(prev => { const next = { ...prev }; delete next[shipmentId]; return next; });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('No active session. Please sign in again.');
      }

      const requestBody = { shipment_id: shipmentId };
      console.log('[ShipEngine] Sending request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipengine-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log('[ShipEngine] Response status:', response.status);

      const raw = await response.text();
      let payload: any = {};
      if (raw) {
        try {
          payload = JSON.parse(raw);
          console.log('[ShipEngine] Response payload:', JSON.stringify(payload, null, 2));
        } catch {
          payload = { error: raw };
        }
      }

      if (!response.ok) {
        throw new Error(formatFunctionError(payload, `Label generation failed (${response.status})`));
      }

      if (payload?.error) {
        throw new Error(formatFunctionError(payload, payload.error));
      }

      toast.success('Shipping label generated successfully');
      queryClient.invalidateQueries({ queryKey: ['shipping-labels'] });
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate label';
      setRowErrors(prev => ({ ...prev, [shipmentId]: msg }));
      toast.error(msg);
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(shipmentId);
        return next;
      });
    }
  }, [queryClient]);

  const handleBulkGenerate = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleGenerateLabel(id);
    }
    setSelectedIds(new Set());
  }, [selectedIds, handleGenerateLabel]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Shipping Labels
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orders missing shipping labels — generate via ShipEngine
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {totalCount} missing
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders, buyers, tracking..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={selectedShowDate || ''}
              onChange={(e) => { setSelectedShowDate(e.target.value || undefined); setPage(0); }}
              className="w-[160px]"
              placeholder="Show date"
            />
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Button onClick={handleBulkGenerate} size="sm" className="gap-2">
                  <Tag className="h-4 w-4" />
                  Generate {selectedIds.size} Label{selectedIds.size > 1 ? 's' : ''}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            )}
          </div>
          {/* Select all banner */}
          {shipments.length > 0 && shipments.every(s => selectedIds.has(s.id)) && selectedIds.size < totalCount && (
            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <span>All {shipments.length} on this page are selected.</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-sm"
                onClick={handleSelectAllFiltered}
                disabled={isSelectingAll}
              >
                {isSelectingAll ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Selecting...</>
                ) : (
                  <>Select all {totalCount} orders</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={shipments.length > 0 && shipments.every(s => selectedIds.has(s.id))}
                    onCheckedChange={handleSelectPage}
                  />
                </TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Show Date</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    No shipments missing labels
                  </TableCell>
                </TableRow>
              ) : (
                shipments.map((s) => (
                  <TableRow key={s.id} className={rowErrors[s.id] ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(s.id)}
                        onCheckedChange={() => toggleSelect(s.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.order_id}</TableCell>
                    <TableCell className="font-mono text-xs">{s.uid || '—'}</TableCell>
                    <TableCell>{s.buyer || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{s.product_name || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{s.address_full || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{s.tracking || '—'}</TableCell>
                    <TableCell className="text-xs">{s.show_date || '—'}</TableCell>
                    <TableCell className="text-right space-y-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generatingIds.has(s.id)}
                        onClick={() => handleGenerateLabel(s.id)}
                        className="gap-1"
                      >
                        {generatingIds.has(s.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3 w-3" />
                        )}
                        Generate
                      </Button>
                      {rowErrors[s.id] && (
                        <div className="flex items-start gap-1 text-destructive text-xs max-w-[250px] text-left">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="break-words">{rowErrors[s.id]}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
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
                  <PaginationLink
                    isActive={page === pageNum}
                    onClick={() => setPage(pageNum)}
                    className="cursor-pointer"
                  >
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
      )}
    </div>
  );
}
