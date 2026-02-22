import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Users, Package, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BuyerSummary {
  buyer: string;
  order_count: number;
  total_revenue: number;
  last_order_date: string | null;
  printed_count: number;
}

export default function Customers() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [buyers, setBuyers] = useState<BuyerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setAuthorized(true);
      loadBuyers();
    })();
  }, []);

  const loadBuyers = async () => {
    setLoading(true);
    // Get all shipments grouped by buyer
    const { data, error } = await supabase
      .from('shipments')
      .select('buyer, price, printed, created_at')
      .not('buyer', 'is', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    // Aggregate by buyer
    const buyerMap = new Map<string, BuyerSummary>();
    for (const row of data) {
      const name = row.buyer?.trim();
      if (!name) continue;
      
      const existing = buyerMap.get(name);
      const price = parseFloat(row.price?.replace(/[^0-9.]/g, '') || '0') || 0;

      if (existing) {
        existing.order_count += 1;
        existing.total_revenue += price;
        if (row.printed) existing.printed_count += 1;
        if (!existing.last_order_date || (row.created_at && row.created_at > existing.last_order_date)) {
          existing.last_order_date = row.created_at;
        }
      } else {
        buyerMap.set(name, {
          buyer: name,
          order_count: 1,
          total_revenue: price,
          last_order_date: row.created_at,
          printed_count: row.printed ? 1 : 0,
        });
      }
    }

    const sorted = Array.from(buyerMap.values()).sort((a, b) => b.order_count - a.order_count);
    setBuyers(sorted);
    setLoading(false);
  };

  const filtered = buyers.filter((b) => {
    if (!search) return true;
    return b.buyer.toLowerCase().includes(search.toLowerCase());
  });

  if (!authorized) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Customers
          </h1>
          <p className="text-muted-foreground">
            {buyers.length} unique buyers across all orders
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search buyers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading buyers...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Printed</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No buyers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => (
                    <TableRow
                      key={b.buyer}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => navigate(`/customers/${encodeURIComponent(b.buyer)}`)}
                    >
                      <TableCell className="font-medium">{b.buyer}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="gap-1">
                          <Package className="h-3 w-3" />
                          {b.order_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground">
                          {b.printed_count}/{b.order_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <DollarSign className="h-3 w-3" />
                          {b.total_revenue.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
