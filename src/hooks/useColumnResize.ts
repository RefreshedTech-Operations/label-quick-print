import { useState, useEffect, useCallback } from 'react';

interface ColumnWidths {
  [key: string]: number;
}

const DEFAULT_WIDTHS: ColumnWidths = {
  uid: 120,
  product: 200,
  location: 150,
  shipping: 200,
  quantity: 100,
  price: 100,
  status: 150,
  printHistory: 180,
  showDate: 120,
};

export function useColumnResize(storageKey: string = 'table-column-widths') {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? { ...DEFAULT_WIDTHS, ...JSON.parse(stored) } : DEFAULT_WIDTHS;
  });

  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(columnWidths));
  }, [columnWidths, storageKey]);

  const handleResizeStart = useCallback((columnId: string, clientX: number) => {
    setResizingColumn(columnId);
    setStartX(clientX);
    setStartWidth(columnWidths[columnId] || DEFAULT_WIDTHS[columnId]);
  }, [columnWidths]);

  const handleResizeMove = useCallback((clientX: number) => {
    if (!resizingColumn) return;
    
    const diff = clientX - startX;
    const newWidth = Math.max(80, startWidth + diff); // Min width of 80px
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth,
    }));
  }, [resizingColumn, startX, startWidth]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleResizeMove(e.clientX);
    };

    const handleMouseUp = () => {
      handleResizeEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  const resetWidths = useCallback(() => {
    setColumnWidths(DEFAULT_WIDTHS);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    columnWidths,
    handleResizeStart,
    resizingColumn,
    resetWidths,
  };
}
