import { jsPDF } from 'jspdf';

export interface PickListItem {
  product_name: string;
  uid: string | null;
  quantity: number;
}

export interface PickListData {
  buyer: string;
  tracking: string;
  order_id: string;
  items: PickListItem[];
}

export function generatePickListPDF(data: PickListData): string {
  // 4x6 inches = 288x432 points at 72 DPI
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [288, 432]
  });

  const pageWidth = 288;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PICK LIST', pageWidth / 2, y, { align: 'center' });
  y += 20;

  // Divider
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // Order details
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Buyer:', margin, y);
  doc.setFont('helvetica', 'normal');
  const buyerText = doc.splitTextToSize(data.buyer, contentWidth - 40);
  doc.text(buyerText, margin + 40, y);
  y += buyerText.length * 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Tracking:', margin, y);
  doc.setFont('helvetica', 'normal');
  const trackingText = doc.splitTextToSize(data.tracking, contentWidth - 55);
  doc.text(trackingText, margin + 55, y);
  y += trackingText.length * 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Order:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.order_id, margin + 40, y);
  y += 15;

  // Divider
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // Items header
  doc.setFont('helvetica', 'bold');
  doc.text('ITEMS:', margin, y);
  y += 15;

  // Items list
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  data.items.forEach((item, index) => {
    // Check if we need more space
    if (y > 380) {
      doc.addPage([288, 432]);
      y = margin;
    }

    // Checkbox
    doc.rect(margin, y - 7, 8, 8);
    
    // Product name with quantity
    const itemText = `${item.product_name} (x${item.quantity})`;
    const wrappedText = doc.splitTextToSize(itemText, contentWidth - 20);
    doc.text(wrappedText, margin + 12, y);
    y += wrappedText.length * 10;
    
    // UID if available
    if (item.uid) {
      doc.setFont('helvetica', 'italic');
      doc.text(`UID: ${item.uid}`, margin + 12, y);
      doc.setFont('helvetica', 'normal');
      y += 10;
    }
    
    y += 5; // Space between items
  });

  // Total items at bottom
  y = Math.max(y + 10, 400);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Items: ${data.items.reduce((sum, item) => sum + item.quantity, 0)}`, margin, y);

  // Return base64 PDF content for PrintNode
  return doc.output('datauristring').split(',')[1];
}

export function createPickListPrintJob(
  printerId: number,
  data: PickListData
): any {
  const pdfContent = generatePickListPDF(data);
  
  return {
    printerId,
    title: `Pick List - ${data.order_id}`,
    contentType: 'pdf_base64',
    content: pdfContent,
    source: 'whatnot-picklist',
    options: {
      copies: 1
    }
  };
}
