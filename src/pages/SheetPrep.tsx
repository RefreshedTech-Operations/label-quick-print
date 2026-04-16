import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { parseFile } from '@/lib/csv';
import { transformTikTokRows, TIKTOK_OUTPUT_HEADERS } from '@/lib/tiktokPrep';
import { toast } from 'sonner';

type PrepType = 'tiktok';

const PREP_TYPES: { value: PrepType; label: string; description: string }[] = [
  { value: 'tiktok', label: 'TikTok', description: 'Convert raw TikTok seller-center export to upload-ready format' },
];

function applyPrepRules(data: any[], prepType: PrepType): { rows: any[]; columns: string[] } {
  switch (prepType) {
    case 'tiktok': {
      const rows = transformTikTokRows(data);
      return { rows, columns: [...TIKTOK_OUTPUT_HEADERS] };
    }
    default:
      return { rows: data, columns: data.length > 0 ? Object.keys(data[0]) : [] };
  }
}

export default function SheetPrep() {
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [processedData, setProcessedData] = useState<any[] | null>(null);
  const [processedColumns, setProcessedColumns] = useState<string[]>([]);
  const [prepType, setPrepType] = useState<PrepType>('tiktok');
  const [loading, setLoading] = useState(false);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setProcessedData(null);
    setProcessedColumns([]);
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
      const { rows, columns } = applyPrepRules(rawData, prepType);
      setProcessedData(rows);
      setProcessedColumns(columns);
      toast.success(`Processed ${rows.length} rows (from ${rawData.length} raw)`);
    } catch (err: any) {
      toast.error(err.message || 'Processing failed');
    } finally {
      setLoading(false);
    }
  }, [rawData, prepType]);

  const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'output';

  const handleDownloadCSV = useCallback(() => {
    if (!processedData || processedData.length === 0) return;
    const headers = processedColumns.length ? processedColumns : Object.keys(processedData[0]);
    const csvRows = [
      headers.join(','),
      ...processedData.map(row =>
        headers.map(h => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_prepped.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [processedData, processedColumns, baseName]);

  const handleDownloadXLSX = useCallback(() => {
    if (!processedData || processedData.length === 0) return;
    const headers = processedColumns.length ? processedColumns : Object.keys(processedData[0]);
    const aoa: any[][] = [headers, ...processedData.map(r => headers.map(h => r[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `${baseName}_prepped.xlsx`);
  }, [processedData, processedColumns, baseName]);

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
