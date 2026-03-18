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
import { Search, Truck, Tag, Loader2, ExternalLink, AlertCircle } from 'lucide-react';


const PAGE_SIZE = 25;

export default function ShippingLabels() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedShowDate, setSelectedShowDate] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const debouncedSearch = useAdaptiveDebounce(search, 600);

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

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === shipments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shipments.map(s => s.id)));
    }
  }, [shipments, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleGenerateLabel = useCallback(async (shipmentId: string) => {
    setGeneratingIds(prev => new Set(prev).add(shipmentId));
    setRowErrors(prev => { const next = { ...prev }; delete next[shipmentId]; return next; });
    try {
      const { data, error } = await supabase.functions.invoke('shipengine-proxy', {
        body: { shipment_id: shipmentId },
      });

      if (error) {
        // Try to parse the response body for detailed error
        const errBody = data || {};
        throw new Error(errBody.error || error.message || 'Failed to generate label');
      }
      if (data?.error) throw new Error(data.error);

      toast.success('Shipping label generated successfully');
      queryClient.invalidateQueries({ queryKey: ['shipping-labels'] });
    } catch (err: any) {
      const msg = err.message || 'Failed to generate label';
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
              <Button onClick={handleBulkGenerate} size="sm" className="gap-2">
                <Tag className="h-4 w-4" />
                Generate {selectedIds.size} Label{selectedIds.size > 1 ? 's' : ''}
              </Button>
            )}
          </div>
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
                    checked={shipments.length > 0 && selectedIds.size === shipments.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Show Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
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
