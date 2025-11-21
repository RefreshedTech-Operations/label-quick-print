import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package2, CalendarIcon, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { Batch } from '@/types/batch';

export default function BatchManagement() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadBatches();
    }
  }, [user, statusFilter]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to access batch management');
      return;
    }
    setUser(user);
    setLoading(false);
  };

  const loadBatches = async () => {
    let query = supabase
      .from('batches')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load batches');
      console.error(error);
      return;
    }

    setBatches((data as Batch[]) || []);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scanning':
        return 'bg-blue-500';
      case 'complete':
        return 'bg-green-500';
      case 'shipped':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Batch Management</h1>
        <p className="text-muted-foreground">View and manage all shipping batches</p>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
        >
          All Batches
        </Button>
        <Button
          variant={statusFilter === 'scanning' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('scanning')}
        >
          Scanning
        </Button>
        <Button
          variant={statusFilter === 'complete' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('complete')}
        >
          Complete
        </Button>
        <Button
          variant={statusFilter === 'shipped' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('shipped')}
        >
          Shipped
        </Button>
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package2 className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No batches found</p>
            <p className="text-muted-foreground mb-4">
              {statusFilter === 'all'
                ? 'Create your first batch to get started'
                : `No batches with status: ${statusFilter}`}
            </p>
            <Button onClick={() => navigate('/batch-scanning')}>
              Create New Batch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <Card key={batch.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">{batch.name}</CardTitle>
                  <Badge className={getStatusColor(batch.status)}>
                    {getStatusLabel(batch.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-lg">{batch.package_count}</span>
                  <span className="text-muted-foreground">packages</span>
                </div>

                {batch.show_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    <span>Show: {format(new Date(batch.show_date), 'MMM d, yyyy')}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Created: {format(new Date(batch.created_at), 'MMM d, yyyy h:mm a')}</span>
                </div>

                {batch.completed_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Completed: {format(new Date(batch.completed_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                )}

                {batch.status === 'scanning' && (
                  <Button
                    onClick={() => navigate('/batch-scanning')}
                    className="w-full mt-2"
                    size="sm"
                  >
                    Continue Scanning
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
