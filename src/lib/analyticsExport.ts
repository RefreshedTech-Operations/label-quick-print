import Papa from 'papaparse';
import { Shipment, PrintJob } from '@/types';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

export function exportFilteredOrders(shipments: Shipment[], dateRange: DateRange) {
  const csvData = shipments.map(shipment => ({
    'UID': shipment.uid || '-',
    'Order ID': shipment.order_id || '-',
    'Group ID': shipment.order_group_id || '-',
    'Buyer': shipment.buyer || '-',
    'Product Name': shipment.product_name || '-',
    'Quantity': shipment.quantity || '-',
    'Price': shipment.price || '-',
    'Tracking': shipment.tracking || '-',
    'Address': shipment.address_full || '-',
    'Location ID': shipment.location_id || '-',
    'Printed': shipment.printed ? 'Yes' : 'No',
    'Printed At': shipment.printed_at ? format(new Date(shipment.printed_at), 'yyyy-MM-dd HH:mm') : '-',
    'Printed By': shipment.printed_by?.email || '-',
    'Cancelled': shipment.cancelled || 'No',
    'Group Label Printed': shipment.group_id_printed ? 'Yes' : 'No',
    'Group Label Printed At': shipment.group_id_printed_at ? format(new Date(shipment.group_id_printed_at), 'yyyy-MM-dd HH:mm') : '-',
    'Group Label Printed By': shipment.group_id_printed_by?.email || '-',
    'Bundle': shipment.bundle ? 'Yes' : 'No',
    'Show Date': shipment.show_date || '-',
    'Created At': format(new Date(shipment.created_at), 'yyyy-MM-dd HH:mm'),
    'Label URL': shipment.label_url || '-',
    'Manifest URL': shipment.manifest_url || '-',
  }));

  const csv = Papa.unparse(csvData);
  const dateRangeStr = dateRange.from && dateRange.to 
    ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
    : format(new Date(), 'yyyy-MM-dd');
  
  downloadCSV(csv, `orders_export_${dateRangeStr}.csv`);
}

export function exportPrintJobs(printJobs: PrintJob[], dateRange: DateRange) {
  const csvData = printJobs.map(job => ({
    'Print Job ID': job.id,
    'UID': job.uid || '-',
    'Order ID': job.order_id || '-',
    'Printer ID': job.printer_id || '-',
    'PrintNode Job ID': job.printnode_job_id || '-',
    'Status': job.status || '-',
    'Error': job.error || '-',
    'Label URL': job.label_url || '-',
    'Created At': format(new Date(job.created_at), 'yyyy-MM-dd HH:mm'),
  }));

  const csv = Papa.unparse(csvData);
  const dateRangeStr = dateRange.from && dateRange.to 
    ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
    : format(new Date(), 'yyyy-MM-dd');
  
  downloadCSV(csv, `print_jobs_export_${dateRangeStr}.csv`);
}

export function exportSummaryReport(kpis: any, dateRange: DateRange) {
  const summaryData = [
    { Metric: 'Total Orders', Value: kpis.totalOrders },
    { Metric: 'Printed Orders', Value: `${kpis.printedOrders} (${kpis.printedPercentage}%)` },
    { Metric: 'Bundle Orders', Value: `${kpis.bundleOrders} (${kpis.bundlePercentage}%)` },
    { Metric: 'Cancelled Orders', Value: `${kpis.cancelledOrders} (${kpis.cancelledPercentage}%)` },
    { Metric: 'Total Print Jobs', Value: kpis.totalPrintJobs },
    { Metric: 'Successful Prints', Value: `${kpis.successfulPrints} (${kpis.printSuccessRate}%)` },
  ];

  const csv = Papa.unparse(summaryData);
  const dateRangeStr = dateRange.from && dateRange.to 
    ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
    : format(new Date(), 'yyyy-MM-dd');
  
  downloadCSV(csv, `summary_report_${dateRangeStr}.csv`);
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
