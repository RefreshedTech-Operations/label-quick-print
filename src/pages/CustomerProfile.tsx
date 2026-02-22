import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Package, Loader2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const buyerName = decodeURIComponent(id || '');
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setAuthorized(true);
    })();
  }, []);

  useEffect(() => {
    if (!authorized || !buyerName) return;
    loadOrders();
  }, [authorized, buyerName]);

  const loadOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shipments')
      .select('id, order_id, uid, product_name, quantity, price, tracking, printed, printed_at, created_at, show_date, cancelled, bundle, label_url')
      .eq('buyer', buyerName)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  if (!authorized) return null;

  const totalRevenue = orders.reduce((sum, o) => {
    return sum + (parseFloat(o.price?.replace(/[^0-9.]/g, '') || '0') || 0);
  }, 0);
  const printedCount = orders.filter(o => o.printed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{buyerName}</h1>
          <p className="text-muted-foreground">Buyer Profile</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Package className="h-4 w-4" /> Total Orders
            </div>
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm mb-1">Printed</div>
            <div className="text-2xl font-bold">{printedCount}/{orders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" /> Revenue
            </div>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm mb-1">Bundles</div>
            <div className="text-2xl font-bold">{orders.filter(o => o.bundle).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No orders found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Show Date</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{o.product_name || '—'}</TableCell>
                    <TableCell>{o.quantity}</TableCell>
                    <TableCell>{o.price || '—'}</TableCell>
                    <TableCell>
                      {o.show_date ? format(new Date(o.show_date), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">
                      {o.tracking || '—'}
                    </TableCell>
                    <TableCell>
                      {o.cancelled && o.cancelled.toLowerCase() === 'yes' ? (
                        <Badge variant="destructive">Cancelled</Badge>
                      ) : (
                        <Badge variant={o.printed ? 'default' : 'secondary'}>
                          {o.printed ? 'Printed' : 'Unprinted'}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
