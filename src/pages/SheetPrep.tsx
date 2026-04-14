import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { parseFile } from '@/lib/csv';
import { toast } from 'sonner';

type PrepType = 'tiktok';

const PREP_TYPES: { value: PrepType; label: string; description: string }[] = [
  { value: 'tiktok', label: 'TikTok', description: 'Prepare TikTok export sheets for upload' },
];

function applyPrepRules(data: any[], prepType: PrepType): any[] {
  // Placeholder — rules will be built out per prep type
  switch (prepType) {
    case 'tiktok':
      return data;
    default:
      return data;
  }
}

export default function SheetPrep() {
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [processedData, setProcessedData] = useState<any[] | null>(null);
  const [prepType, setPrepType] = useState<PrepType>('tiktok');
  const [loading, setLoading] = useState(false);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setProcessedData(null);
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
      const result = applyPrepRules(rawData, prepType);
      setProcessedData(result);
      toast.success(`Processed ${result.length} rows`);
    } catch (err: any) {
      toast.error(err.message || 'Processing failed');
    } finally {
      setLoading(false);
    }
  }, [rawData, prepType]);

  const handleDownload = useCallback(() => {
    if (!processedData || processedData.length === 0) return;
    const headers = Object.keys(processedData[0]);
    const csvRows = [
      headers.join(','),
      ...processedData.map(row =>
        headers.map(h => {
          const val = String(row[h] ?? '');
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        }).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'output';
    a.download = `${baseName}_prepped.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [processedData, file]);

  const previewData = processedData || rawData;
  const columns = previewData.length > 0 ? Object.keys(previewData[0]) : [];
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

            <div className="flex gap-2 mt-4">
              <Button onClick={handleProcess} disabled={rawData.length === 0 || loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Process
              </Button>
              {processedData && (
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4" /> Download
                </Button>
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
                        {String(row[col] ?? '')}
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
