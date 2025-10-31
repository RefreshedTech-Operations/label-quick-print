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
  contentType: 'pdf_uri' | 'html';
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
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            size: 4in 6in;
            margin: 0;
          }
          body {
            width: 4in;
            height: 6in;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: Arial, sans-serif;
            background: white;
          }
          .group-id-label {
            text-align: center;
            padding: 20px;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 30px;
            color: #333;
          }
          .group-id {
            font-size: 16px;
            font-weight: bold;
            word-wrap: break-word;
            max-width: 3.5in;
            margin-bottom: 20px;
            color: #000;
            font-family: 'Courier New', monospace;
          }
          .uid {
            font-size: 14px;
            color: #666;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="group-id-label">
          <div class="title">BUNDLE GROUP ID</div>
          <div class="group-id">${groupId}</div>
          <div class="uid">UID: ${uid}</div>
        </div>
      </body>
    </html>
  `;
  
  return {
    printerId,
    title: `Bundle Group ID - ${uid}`,
    contentType: 'html',
    content: html,
    source: 'whatnot-labels',
    options: {
      paper: '4x6'
    }
  };
}
