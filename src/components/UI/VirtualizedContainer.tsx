import React, { useState, useEffect, useRef, useMemo } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  containerClassName?: string;
  overscan?: number;
}

export function VirtualizedList<T>({ 
  items, 
  itemHeight, 
  renderItem, 
  containerClassName = "",
  overscan = 5 
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      setScrollTop((e.target as HTMLDivElement).scrollTop);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      setContainerHeight(container.clientHeight);

      const resizeObserver = new ResizeObserver(entries => {
        if (entries[0]) {
          setContainerHeight(entries[0].contentRect.height);
        }
      });
      resizeObserver.observe(container);

      return () => {
        container.removeEventListener('scroll', handleScroll);
        resizeObserver.disconnect();
      };
    }
  }, []);

  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight)
    );

    return {
      startIndex: Math.max(0, start - overscan),
      endIndex: Math.min(items.length - 1, end + overscan)
    };
  }, [scrollTop, containerHeight, items.length, itemHeight, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, idx) => {
      const actualIndex = startIndex + idx;
      return (
        <div 
          key={actualIndex}
          style={{
            position: 'absolute',
            top: actualIndex * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight
          }}
        >
          {renderItem(item, actualIndex)}
        </div>
      );
    });
  }, [items, startIndex, endIndex, itemHeight, renderItem]);

  return (
    <div 
      ref={containerRef} 
      className={`overflow-auto relative ${containerClassName}`}
      style={{ height: '100%', width: '100%' }}
    >
      <div style={{ height: items.length * itemHeight, width: '100%', position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
}

// Grid version
interface VirtualizedGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  containerClassName?: string;
  overscanRows?: number;
  gap?: number;
}

export function VirtualizedGrid<T>({
  items,
  itemWidth,
  itemHeight,
  renderItem,
  containerClassName = "",
  overscanRows = 2,
  gap = 16
}: VirtualizedGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleScroll = (e: Event) => {
      setScrollTop((e.target as HTMLDivElement).scrollTop);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      setContainerSize({ width: container.clientWidth, height: container.clientHeight });

      const resizeObserver = new ResizeObserver(entries => {
        if (entries[0]) {
          setContainerSize({ 
            width: entries[0].contentRect.width, 
            height: entries[0].contentRect.height 
          });
        }
      });
      resizeObserver.observe(container);

      return () => {
        container.removeEventListener('scroll', handleScroll);
        resizeObserver.disconnect();
      };
    }
  }, []);

  const { itemsPerRow, totalRows, startIndex, endIndex } = useMemo(() => {
    const rowWidth = itemWidth + gap;
    const effectiveContainerWidth = containerSize.width - gap; // Account for the right padding
    const cols = Math.max(1, Math.floor(effectiveContainerWidth / rowWidth));
    const rows = Math.ceil(items.length / cols);

    const startRow = Math.floor(scrollTop / (itemHeight + gap));
    const visibleRows = Math.ceil(containerSize.height / (itemHeight + gap));

    return {
      itemsPerRow: cols,
      totalRows: rows,
      startIndex: Math.max(0, startRow - overscanRows) * cols,
      endIndex: Math.min(items.length - 1, (startRow + visibleRows + overscanRows) * cols + cols - 1)
    };
  }, [scrollTop, containerSize, items.length, itemWidth, itemHeight, gap, overscanRows]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = startIndex; i <= endIndex && i < items.length; i++) {
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;
      
      result.push(
        <div 
          key={i}
          style={{
            position: 'absolute',
            top: row * (itemHeight + gap),
            left: col * (itemWidth + gap),
            width: itemWidth,
            height: itemHeight
          }}
        >
          {renderItem(items[i], i)}
        </div>
      );
    }
    return result;
  }, [items, startIndex, endIndex, itemsPerRow, itemWidth, itemHeight, gap, renderItem]);

  return (
    <div 
      ref={containerRef} 
      className={`overflow-auto relative ${containerClassName}`}
      style={{ height: '100%', width: '100%' }}
    >
      <div style={{ 
        height: totalRows * (itemHeight + gap), 
        width: '100%', 
        position: 'relative',
        padding: `${gap}px` 
      }}>
        {visibleItems}
      </div>
    </div>
  );
}
