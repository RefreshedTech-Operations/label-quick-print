import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface LeaderboardEntry {
  name: string;
  count: number;
  stations?: string[];
}

interface EmployeeLeaderboardTableProps {
  entries: LeaderboardEntry[];
  showStations?: boolean;
  countLabel?: string;
}

export function EmployeeLeaderboardTable({ entries, showStations, countLabel = 'Count' }: EmployeeLeaderboardTableProps) {
  const total = entries.reduce((sum, e) => sum + e.count, 0);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No activity in this period</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">{countLabel}</TableHead>
          <TableHead className="text-right">% of Total</TableHead>
          {showStations && <TableHead>Stations</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, idx) => (
          <TableRow key={`${entry.name}-${idx}`}>
            <TableCell className="text-muted-foreground font-medium">{idx + 1}</TableCell>
            <TableCell className="font-medium">{entry.name}</TableCell>
            <TableCell className="text-right font-mono">{entry.count.toLocaleString('en-US')}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {total > 0 ? `${((entry.count / total) * 100).toFixed(1)}%` : '—'}
            </TableCell>
            {showStations && (
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {entry.stations && entry.stations.length > 0
                    ? entry.stations.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)
                    : <span className="text-xs text-muted-foreground">—</span>}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
