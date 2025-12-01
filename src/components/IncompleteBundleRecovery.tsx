import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, AlertTriangle, Printer, Copy, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/useAppStore';
import { submitPrintJob, createPrintJob } from '@/lib/printnode';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface IncompleteBundleItem {
  id: string;
  uid: string | null;
  product_name: string | null;
  price: string | null;
  order_id: string;
  label_url?: string | null;
  printed_at?: string | null;
}

interface IncompleteBundle {
  tracking: string;
  buyer: string;
  printed_today_count: number;
  unprinted_count: number;
  total_count: number;
  printed_items: IncompleteBundleItem[];
  unprinted_items: IncompleteBundleItem[];
}

interface IncompleteBundleRecoveryProps {
  showDate: string;
  printedDate?: string;
}

export function IncompleteBundleRecovery({ showDate, printedDate }: IncompleteBundleRecoveryProps) {
  const queryClient = useQueryClient();
  const { settings } = useAppStore();
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [copiedBundle, setCopiedBundle] = useState<string | null>(null);

  const { data: bundles, isLoading } = useQuery({
    queryKey: ['incomplete-bundles', showDate, printedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_incomplete_bundles_for_date', {
        p_show_date: showDate,
        p_printed_date: printedDate || format(new Date(), 'yyyy-MM-dd'),
      });

      if (error) throw error;
      
      // Type assertion for the JSON response
      return (data || []).map((bundle: any) => ({
        ...bundle,
        printed_items: (bundle.printed_items || []) as IncompleteBundleItem[],
        unprinted_items: (bundle.unprinted_items || []) as IncompleteBundleItem[],
      })) as IncompleteBundle[];
    },
  });

  const printMutation = useMutation({
    mutationFn: async ({ items, tracking }: { items: IncompleteBundleItem[]; tracking: string }) => {
      const apiKey = localStorage.getItem('printnode_api_key');
      const printerId = settings.default_printer_id;

      if (!apiKey || !printerId) {
        throw new Error('PrintNode API key and default printer must be configured');
      }

      const results = [];
      for (const item of items) {
        if (!item.label_url) continue;

        const job = createPrintJob(Number(printerId), item.uid, item.label_url);
        const jobId = await submitPrintJob(apiKey, job);

        const { error: printJobError } = await supabase.from('print_jobs').insert({
          shipment_id: item.id,
          printnode_job_id: jobId,
          printer_id: printerId,
          uid: item.uid,
          order_id: item.order_id,
          label_url: item.label_url,
          status: 'queued',
        });

        if (printJobError) throw printJobError;

        const { error: updateError } = await supabase
          .from('shipments')
          .update({
            printed: true,
            printed_at: new Date().toISOString(),
            printed_by_user_id: (await supabase.auth.getUser()).data.user?.id,
          })
          .eq('id', item.id);

        if (updateError) throw updateError;

        results.push({ success: true, item });
      }

      return results;
    },
    onSuccess: (_, { tracking }) => {
      queryClient.invalidateQueries({ queryKey: ['incomplete-bundles'] });
      toast.success(`Successfully printed missing items for tracking ${tracking}`);
    },
    onError: (error) => {
      toast.error(`Print failed: ${error.message}`);
    },
  });

  const printAllMutation = useMutation({
    mutationFn: async () => {
      if (!bundles) return;

      const apiKey = localStorage.getItem('printnode_api_key');
      const printerId = settings.default_printer_id;

      if (!apiKey || !printerId) {
        throw new Error('PrintNode API key and default printer must be configured');
      }

      let totalPrinted = 0;
      for (const bundle of bundles) {
        for (const item of bundle.unprinted_items) {
          if (!item.label_url) continue;

          const job = createPrintJob(Number(printerId), item.uid, item.label_url);
          const jobId = await submitPrintJob(apiKey, job);

          await supabase.from('print_jobs').insert({
            shipment_id: item.id,
            printnode_job_id: jobId,
            printer_id: printerId,
            uid: item.uid,
            order_id: item.order_id,
            label_url: item.label_url,
            status: 'queued',
          });

          await supabase
            .from('shipments')
            .update({
              printed: true,
              printed_at: new Date().toISOString(),
              printed_by_user_id: (await supabase.auth.getUser()).data.user?.id,
            })
            .eq('id', item.id);

          totalPrinted++;
        }
      }

      return totalPrinted;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['incomplete-bundles'] });
      toast.success(`Successfully printed ${count} missing items`);
    },
    onError: (error) => {
      toast.error(`Bulk print failed: ${error.message}`);
    },
  });

  const toggleBundle = (tracking: string) => {
    setExpandedBundles(prev => {
      const next = new Set(prev);
      if (next.has(tracking)) {
        next.delete(tracking);
      } else {
        next.add(tracking);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, type: 'uid' | 'bundle', id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'uid') {
        setCopiedUid(id);
        setTimeout(() => setCopiedUid(null), 2000);
      } else {
        setCopiedBundle(id);
        setTimeout(() => setCopiedBundle(null), 2000);
      }
      toast.success('Copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const totalMissing = bundles?.reduce((sum, b) => sum + b.unprinted_count, 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bundles || bundles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            No Incomplete Bundles Found
          </CardTitle>
          <CardDescription>
            All bundles for {showDate} have been fully printed or have no partial prints from today.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                Incomplete Bundles - {showDate}
              </CardTitle>
              <CardDescription className="mt-2">
                {bundles.length} bundles with {totalMissing} missing items that need to be added to already-packed packages
              </CardDescription>
            </div>
            <Button
              size="lg"
              onClick={() => printAllMutation.mutate()}
              disabled={printAllMutation.isPending || !settings.default_printer_id}
              className="gap-2"
            >
              {printAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Print All {totalMissing} Missing Items
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {bundles.map((bundle) => {
          const isExpanded = expandedBundles.has(bundle.tracking);
          
          return (
            <Card key={bundle.tracking} className="border-l-4 border-l-destructive">
              <Collapsible open={isExpanded} onOpenChange={() => toggleBundle(bundle.tracking)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <CollapsibleTrigger className="flex-1 text-left">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Tracking: {bundle.tracking}
                        </CardTitle>
                        <CardDescription>
                          Buyer: {bundle.buyer}
                        </CardDescription>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="bg-background">
                            {bundle.printed_today_count} shipped today
                          </Badge>
                          <Badge variant="destructive">
                            {bundle.unprinted_count} STILL NEED TO GO
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const firstUid = bundle.unprinted_items.find(item => item.uid)?.uid;
                        if (firstUid) {
                          copyToClipboard(firstUid, 'bundle', bundle.tracking);
                        } else {
                          toast.error('No UID available');
                        }
                      }}
                      className="gap-2 shrink-0"
                    >
                      {copiedBundle === bundle.tracking ? (
                        <CheckCheck className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      Copy UID
                    </Button>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      <h4 className="font-semibold text-sm text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        MISSING (need to print & add to package):
                      </h4>
                      <ul className="space-y-2 text-sm">
                        {bundle.unprinted_items.map((item) => (
                          <li key={item.id} className="flex items-start justify-between gap-2 py-1">
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span>
                                {item.product_name || 'Unknown Product'}
                                {item.price && ` - $${item.price}`}
                                {item.uid && (
                                  <span className="font-mono font-semibold ml-1">
                                    (UID: {item.uid})
                                  </span>
                                )}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      onClick={() => printMutation.mutate({ items: bundle.unprinted_items, tracking: bundle.tracking })}
                      disabled={printMutation.isPending || !settings.default_printer_id}
                      className="w-full gap-2"
                    >
                      {printMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                      Print {bundle.unprinted_count} Missing Items for This Bundle
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}