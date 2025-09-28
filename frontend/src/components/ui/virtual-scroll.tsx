/**
 * Virtual scrolling component for performance optimization with large datasets
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className,
  onScroll,
  getItemKey,
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length - 1, end + overscan),
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        item: items[i],
        key: getItemKey ? getItemKey(items[i], i) : i,
      });
    }
    return result;
  }, [items, visibleRange, getItemKey]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  return (
    <div className={className} style={{ height: containerHeight }}>
      <div
        ref={scrollElementRef}
        style={{
          height: containerHeight,
          overflow: 'auto',
        }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleItems.map(({ index, item, key }) => (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: index * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface VirtualTableProps<T> {
  data: T[];
  columns: Array<{
    key: string;
    header: string;
    width?: number;
    render?: (item: T, index: number) => React.ReactNode;
  }>;
  rowHeight?: number;
  containerHeight: number;
  onRowClick?: (item: T, index: number) => void;
  getRowKey?: (item: T, index: number) => string | number;
  className?: string;
}

export function VirtualTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowHeight = 48,
  containerHeight,
  onRowClick,
  getRowKey,
  className,
}: VirtualTableProps<T>) {
  const renderRow = useCallback((item: T, index: number) => {
    return (
      <div
        className={`flex items-center border-b hover:bg-muted/50 ${
          onRowClick ? 'cursor-pointer' : ''
        }`}
        onClick={() => onRowClick?.(item, index)}
        style={{ height: rowHeight }}
      >
        {columns.map((column, colIndex) => (
          <div
            key={column.key}
            className="px-4 py-2 flex-shrink-0"
            style={{ width: column.width || `${100 / columns.length}%` }}
          >
            {column.render ? column.render(item, index) : item[column.key]}
          </div>
        ))}
      </div>
    );
  }, [columns, rowHeight, onRowClick]);

  return (
    <div className={className}>
      {/* Table Header */}
      <div className="flex border-b bg-muted/50 font-medium">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-4 py-3 flex-shrink-0"
            style={{ width: column.width || `${100 / columns.length}%` }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Virtual Scrolled Rows */}
      <VirtualScroll
        items={data}
        itemHeight={rowHeight}
        containerHeight={containerHeight - 48} // Subtract header height
        renderItem={renderRow}
        getItemKey={getRowKey}
      />
    </div>
  );
}

export interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  gap?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  gap = 8,
  getItemKey,
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const columnsPerRow = Math.floor((containerWidth + gap) / (itemWidth + gap));
  const totalRows = Math.ceil(items.length / columnsPerRow);
  const rowHeight = itemHeight + gap;

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / rowHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / rowHeight) + 1,
      totalRows - 1
    );

    return { start: Math.max(0, start), end };
  }, [scrollTop, rowHeight, containerHeight, totalRows]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let row = visibleRange.start; row <= visibleRange.end; row++) {
      for (let col = 0; col < columnsPerRow; col++) {
        const index = row * columnsPerRow + col;
        if (index < items.length) {
          result.push({
            index,
            item: items[index],
            row,
            col,
            key: getItemKey ? getItemKey(items[index], index) : index,
          });
        }
      }
    }
    return result;
  }, [items, visibleRange, columnsPerRow, getItemKey]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return (
    <div style={{ height: containerHeight, overflow: 'auto' }} onScroll={handleScroll}>
      <div
        style={{
          height: totalRows * rowHeight,
          position: 'relative',
          width: '100%',
        }}
      >
        {visibleItems.map(({ index, item, row, col, key }) => (
          <div
            key={key}
            style={{
              position: 'absolute',
              top: row * rowHeight,
              left: col * (itemWidth + gap),
              width: itemWidth,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook for managing virtual scroll state
export const useVirtualScroll = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight),
      itemCount - 1
    );

    return { start: Math.max(0, start), end };
  }, [scrollTop, itemHeight, containerHeight, itemCount]);

  const scrollToIndex = useCallback((index: number) => {
    const targetScrollTop = index * itemHeight;
    setScrollTop(targetScrollTop);
  }, [itemHeight]);

  const scrollToTop = useCallback(() => {
    setScrollTop(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    const maxScrollTop = Math.max(0, itemCount * itemHeight - containerHeight);
    setScrollTop(maxScrollTop);
  }, [itemCount, itemHeight, containerHeight]);

  return {
    scrollTop,
    setScrollTop,
    visibleRange,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
  };
};