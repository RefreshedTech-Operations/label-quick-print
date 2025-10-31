import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { toast } from 'sonner';
import { Printer, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface PrintJob {
  id: string;
  uid: string | null;
  order_id: string | null;
  printer_id: string | null;
  printnode_job_id: number | null;
  status: string | null;
  label_url: string | null;
  error: string | null;
  created_at: string;
  user_id: string;
  user_email?: string;
}

export default function PrintJobs() {
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    loadPrintJobs();
  }, []);

  const loadPrintJobs = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all print jobs with pagination
      let allJobs: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: jobsData, error: jobsError } = await supabase
          .from('print_jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (jobsError) {
          toast.error('Failed to load print jobs');
          setLoading(false);
          return;
        }

        if (jobsData && jobsData.length > 0) {
          allJobs = [...allJobs, ...jobsData];
          hasMore = jobsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Get unique user IDs
      const userIds = [...new Set(allJobs.map(j => j.user_id))];

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);

        const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const enrichedJobs = allJobs.map(job => ({
          ...job,
          user_email: profileMap.get(job.user_id)?.email
        }));

        setPrintJobs(enrichedJobs);
      } else {
        setPrintJobs(allJobs);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = printJobs.filter(j => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        j.uid?.toLowerCase().includes(searchLower) ||
        j.order_id?.toLowerCase().includes(searchLower) ||
        j.printer_id?.toLowerCase().includes(searchLower) ||
        j.printnode_job_id?.toString().includes(searchLower)
      );
    }
    return true;
  });

  const stats = {
    total: filteredJobs.length,
    queued: filteredJobs.filter(j => j.status === 'queued').length,
    completed: filteredJobs.filter(j => j.status === 'completed').length,
    failed: filteredJobs.filter(j => j.status === 'failed' || j.error).length
  };

  // Pagination
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const getStatusBadge = (job: PrintJob) => {
    if (job.error) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
    
    switch (job.status) {
      case 'completed':
        return (
          <Badge className="bg-success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'queued':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Queued
          </Badge>
        );
      default:
        return <Badge variant="outline">{job.status || 'Unknown'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Print Jobs</h1>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            Total: {stats.total}
          </Badge>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Clock className="h-4 w-4 mr-1" />
            Queued: {stats.queued}
          </Badge>
          <Badge className="text-lg px-4 py-2 bg-success">
            <CheckCircle className="h-4 w-4 mr-1" />
            Completed: {stats.completed}
          </Badge>
          <Badge variant="destructive" className="text-lg px-4 py-2">
            <XCircle className="h-4 w-4 mr-1" />
            Failed: {stats.failed}
          </Badge>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          Loading print jobs...
        </div>
      )}

      <div className="flex gap-4">
        <Input
          placeholder="Search by UID, Order ID, Printer ID, or Job ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>UID</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>PrintNode Job ID</TableHead>
              <TableHead>Printer ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Label URL</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No print jobs found
                </TableCell>
              </TableRow>
            ) : (
              paginatedJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono font-semibold">{job.uid || '-'}</TableCell>
                  <TableCell className="font-mono">{job.order_id || '-'}</TableCell>
                  <TableCell className="font-mono">{job.printnode_job_id || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{job.printer_id || '-'}</TableCell>
                  <TableCell>{getStatusBadge(job)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {job.label_url ? (
                      <a
                        href={job.label_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Label
                      </a>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-destructive text-xs" title={job.error || ''}>
                    {job.error || '-'}
                  </TableCell>
                  <TableCell className="text-xs">{job.user_email || '-'}</TableCell>
                  <TableCell>{format(new Date(job.created_at), 'MMM d, yyyy HH:mm:ss')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
