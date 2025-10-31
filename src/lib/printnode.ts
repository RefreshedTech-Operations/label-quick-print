import { jsPDF } from 'jspdf';

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
  uid: string,
  labelUrl: string
): PrintNodeJob {
  return {
    printerId,
    title: `Whatnot Label - ${uid}`,
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
  uid: string
): PrintNodeJob {
  // Create PDF (4x6 inches = 101.6mm x 152.4mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [101.6, 152.4]
  });
  
  // Set font sizes and styles
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  
  // Title
  doc.text('BUNDLE GROUP ID', 50.8, 30, { align: 'center' });
  
  // Group ID
  doc.setFontSize(14);
  doc.setFont('courier', 'bold');
  
  // Split long group ID into multiple lines if needed
  const maxWidth = 90;
  const lines = doc.splitTextToSize(groupId, maxWidth);
  const startY = 60;
  lines.forEach((line: string, index: number) => {
    doc.text(line, 50.8, startY + (index * 8), { align: 'center' });
  });
  
  // UID
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(102, 102, 102);
  doc.text(`UID: ${uid}`, 50.8, 120, { align: 'center' });
  
  // Get PDF as base64 string (remove data URI prefix)
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  
  return {
    printerId,
    title: `Bundle Group ID - ${uid}`,
    contentType: 'pdf_base64',
    content: pdfBase64,
    source: 'whatnot-labels',
    options: {
      paper: '4x6'
    }
  };
}
