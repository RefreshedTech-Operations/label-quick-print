import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

const PRINTNODE_API_URL = 'https://api.printnode.com';

export interface PrintNodePrinter {
  id: number;
  name: string;
  description: string;
  state: string;
}

export interface PrintNodeJob {
  printerId: number;
  title: string;
  contentType: 'pdf_uri' | 'pdf_base64';
  content: string;
  source: string;
  options?: {
    fit_to_page?: boolean;
    paper?: string;
    rotate?: string;
  };
}

export async function fetchPrinters(apiKey: string): Promise<PrintNodePrinter[]> {
  const response = await fetch(`${PRINTNODE_API_URL}/printers`, {
    headers: {
      'Authorization': `Basic ${btoa(`${apiKey}:`)}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch printers from PrintNode');
  }

  return response.json();
}

export async function submitPrintJob(
  apiKey: string,
  job: PrintNodeJob
): Promise<number> {
  const response = await fetch(`${PRINTNODE_API_URL}/printjobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${apiKey}:`)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(job)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PrintNode error: ${error}`);
  }

  const result = await response.json();
  return result[0];
}

export function createPrintJob(
  printerId: number,
  uid: string | null,
  labelUrl: string
): PrintNodeJob {
  return {
    printerId,
    title: `Whatnot Label - ${uid || 'NO-UID'}`,
    contentType: 'pdf_uri',
    content: labelUrl,
    source: 'whatnot-labels',
    options: {
      fit_to_page: true,
      paper: '4x6'
    }
  };
}

export function createGroupIdPrintJob(
  printerId: number,
  groupId: string,
  uid: string | null,
  locationId?: string
): PrintNodeJob {
  // Create PDF (4x6 inches = 101.6mm x 152.4mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [101.6, 152.4]
  });
  
  // Generate barcode using canvas
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, groupId, {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: false,
      margin: 0
    });
    
    // Convert canvas to base64 image
    const barcodeDataUrl = canvas.toDataURL('image/png');
    
    // Add barcode to PDF
    doc.addImage(barcodeDataUrl, 'PNG', 10, 20, 81.6, 20);
  } catch (error) {
    console.error('Failed to generate barcode:', error);
  }
  
  // Title
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('BUNDLE GROUP ID', 50.8, 50, { align: 'center' });
  
  // Location ID (if provided)
  if (locationId) {
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`LOCATION: ${locationId}`, 50.8, 70, { align: 'center' });
  }
  
  // Group ID (text version below barcode)
  doc.setFontSize(10);
  doc.setFont('courier', 'bold');
  doc.setTextColor(0, 0, 0);
  
  // Split long group ID into multiple lines if needed
  const maxWidth = 90;
  const lines = doc.splitTextToSize(groupId, maxWidth);
  const startY = locationId ? 90 : 80;
  lines.forEach((line: string, index: number) => {
    doc.text(line, 50.8, startY + (index * 6), { align: 'center' });
  });
  
  // UID
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(102, 102, 102);
  doc.text(`UID: ${uid || 'NO-UID'}`, 50.8, 130, { align: 'center' });
  
  // Get PDF as base64 string (remove data URI prefix)
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  
  return {
    printerId,
    title: `Bundle Group ID - ${uid || 'NO-UID'}`,
    contentType: 'pdf_base64',
    content: pdfBase64,
    source: 'whatnot-labels',
    options: {
      paper: '4x6'
    }
  };
}
