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
  contentType: string;
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
      paper: '4x6',
      rotate: 'auto'
    }
  };
}
