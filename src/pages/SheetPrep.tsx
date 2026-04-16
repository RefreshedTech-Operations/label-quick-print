import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, Loader2, Send } from 'lucide-react';
import { parseFile } from '@/lib/csv';
import { transformTikTokRows, TIKTOK_OUTPUT_HEADERS } from '@/lib/tiktokPrep';
import { toast } from 'sonner';

type PrepType = 'tiktok';

const PREP_TYPES: { value: PrepType; label: string; description: string }[] = [
  { value: 'tiktok', label: 'TikTok', description: 'Convert raw TikTok seller-center export to upload-ready format' },
];

const PREP_TYPE_STORAGE_KEY = 'sheetPrep.lastPrepType';
export const SHEET_PREP_HANDOFF_KEY = 'sheetPrep.handoff';

interface PrepStats {
  rawIn: number;
  descriptionRowDropped: number;
  cancelledDropped: number;
  finalOut: number;
  missingTracking: number;
  missingAddress: number;
}

interface PrepResult {
  rows: any[];
  columns: string[];
  stats: PrepStats;
}

function applyPrepRules(data: any[], prepType: PrepType): PrepResult {
  switch (prepType) {
    case 'tiktok': {
      const rawIn = data.length;
      // Detect & drop the TikTok "description" row (first row whose Order ID
      // cell is the column-description text).
      let descriptionRowDropped = 0;
      const descFiltered = data.filter(r => {
        const oid = String(r['Order ID'] ?? '').trim().toLowerCase();
        if (oid.startsWith('platform unique')) {
          descriptionRowDropped += 1;
          return false;
        }
        return true;
      });

      const rows = transformTikTokRows(descFiltered);
      // Anything dropped that wasn't the description row is a cancellation.
      const cancelledDropped = descFiltered.length - rows.length;

      const missingTracking = rows.filter(r => !r['tracking']).length;
      const missingAddress = rows.filter(r => !r['shipping address']).length;

      return {
        rows,
        columns: [...TIKTOK_OUTPUT_HEADERS],
        stats: {
          rawIn,
          descriptionRowDropped,
          cancelledDropped,
          finalOut: rows.length,
          missingTracking,
          missingAddress,
        },
      };
    }
    default:
      return {
        rows: data,
        columns: data.length > 0 ? Object.keys(data[0]) : [],
        stats: {
          rawIn: data.length,
          descriptionRowDropped: 0,
          cancelledDropped: 0,
          finalOut: data.length,
          missingTracking: 0,
          missingAddress: 0,
        },
      };
  }
}

function buildCSV(rows: any[], headers: string[]): string {
  const csvRows = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : String(val);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ),
  ];
  return csvRows.join('\n');
}

export default function SheetPrep() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [processedData, setProcessedData] = useState<any[] | null>(null);
  const [processedColumns, setProcessedColumns] = useState<string[]>([]);
  const [stats, setStats] = useState<PrepStats | null>(null);
  const [prepType, setPrepType] = useState<PrepType>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(PREP_TYPE_STORAGE_KEY) : null;
    if (saved && PREP_TYPES.some(p => p.value === saved)) return saved as PrepType;
    return 'tiktok';
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(PREP_TYPE_STORAGE_KEY, prepType); } catch { /* ignore */ }
  }, [prepType]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setProcessedData(null);
    setProcessedColumns([]);
    setStats(null);
    try {
      const parsed = await parseFile(selected);
      setRawData(parsed);
      toast.success(`Loaded ${parsed.length} rows`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file');
      setRawData([]);
    }
  }, []);

  const handleProcess = useCallback(() => {
    if (rawData.length === 0) return;
    setLoading(true);
    try {
      const { rows, columns, stats: s } = applyPrepRules(rawData, prepType);
      setProcessedData(rows);
      setProcessedColumns(columns);
      setStats(s);
      toast.success(`Processed ${rows.length} rows (from ${rawData.length} raw)`);
    } catch (err: any) {
      toast.error(err.message || 'Processing failed');
    } finally {
      setLoading(false);
    }
  }, [rawData, prepType]);

  const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'output';

  const headersForOutput = useMemo(() => {
    if (!processedData || processedData.length === 0) return [];
    return processedColumns.length ? processedColumns : Object.keys(processedData[0]);
  }, [processedData, processedColumns]);

  const handleDownloadCSV = useCallback(() => {
    if (!processedData || processedData.length === 0) return;
    const csv = buildCSV(processedData, headersForOutput);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_prepped.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [processedData, headersForOutput, baseName]);

  const handleDownloadXLSX = useCallback(() => {
    if (!processedData || processedData.length === 0) return;
    const aoa: any[][] = [headersForOutput, ...processedData.map(r => headersForOutput.map(h => r[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `${baseName}_prepped.xlsx`);
  }, [processedData, headersForOutput, baseName]);

  const handleSendToUpload = useCallback(() => {
    if (!processedData || processedData.length === 0) return;
    const csv = buildCSV(processedData, headersForOutput);
    const suggestedChannel: Record<PrepType, string> = { tiktok: 'tiktok' };
    try {
      sessionStorage.setItem(
        SHEET_PREP_HANDOFF_KEY,
        JSON.stringify({
          csv,
          fileName: `${baseName}_prepped.csv`,
          rowCount: processedData.length,
          channel: suggestedChannel[prepType],
        }),
      );
      toast.success(`Sending ${processedData.length} rows to Upload`);
      navigate('/upload');
    } catch (err: any) {
      toast.error(err.message || 'Could not stage data for Upload');
    }
  }, [processedData, headersForOutput, baseName, prepType, navigate]);

  const previewData = processedData || rawData;
  const columns = processedData
    ? (processedColumns.length ? processedColumns : Object.keys(processedData[0] ?? {}))
    : (previewData.length > 0 ? Object.keys(previewData[0]) : []);
  const previewRows = previewData.slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Sheet Prep</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" /> Upload File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
            {file && (
              <p className="mt-2 text-sm text-muted-foreground">
                {file.name} — {rawData.length} rows
              </p>
            )}
          </CardContent>
        </Card>

        {/* Prep type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4" /> Prep Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={prepType} onValueChange={(v) => setPrepType(v as PrepType)}>
              {PREP_TYPES.map(pt => (
                <div key={pt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={pt.value} id={`prep-${pt.value}`} />
                  <Label htmlFor={`prep-${pt.value}`} className="cursor-pointer">
                    {pt.label} <span className="text-muted-foreground text-xs">— {pt.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={handleProcess} disabled={rawData.length === 0 || loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Process
              </Button>
              {processedData && processedData.length > 0 && (
                <>
                  <Button onClick={handleSendToUpload}>
                    <Send className="h-4 w-4" /> Send to Upload
                  </Button>
                  <Button variant="outline" onClick={handleDownloadXLSX}>
                    <Download className="h-4 w-4" /> Download XLSX
                  </Button>
                  <Button variant="outline" onClick={handleDownloadCSV}>
                    <Download className="h-4 w-4" /> Download CSV
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats summary */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatTile label="Raw rows in" value={stats.rawIn} />
              <StatTile label="Description row dropped" value={stats.descriptionRowDropped} />
              <StatTile label="Cancelled / failed dropped" value={stats.cancelledDropped} />
              <StatTile label="Final rows out" value={stats.finalOut} emphasis />
              <StatTile label="Missing tracking" value={stats.missingTracking} warn={stats.missingTracking > 0} />
              <StatTile label="Missing address" value={stats.missingAddress} warn={stats.missingAddress > 0} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {processedData ? 'Processed Preview' : 'Raw Preview'} ({previewData.length} rows)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map(col => (
                      <TableCell key={col} className="whitespace-nowrap max-w-[200px] truncate">
                        {row[col] === null || row[col] === undefined ? '' : String(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {previewData.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2">Showing 10 of {previewData.length} rows</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  emphasis,
  warn,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          'mt-1 text-2xl font-semibold ' +
          (warn ? 'text-destructive' : emphasis ? 'text-primary' : 'text-foreground')
        }
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
