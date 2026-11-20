import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Reordering a list by dragging its rows (the queue, a playlist): with a mouse
 * the row is dragged where it should go; on a touch screen a swipe up or down
 * moves it one place. `itemProps(index)` goes on each row (spread it on the
 * <li>), `dragOverIndex` is the row a drag is over, for its mark.
 * `handleOnly`: in a list that scrolls (a playlist), only a swipe that starts
 * on the row's handle (DragHandle) moves it; elsewhere the swipe scrolls.
 */
export function useDragReorder(count: number, onReorder?: (fromIndex: number, toIndex: number) => void, { handleOnly = false }: { handleOnly?: boolean } = {}) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const touchIndexRef = useRef<number | null>(null);

  const onDragEnd = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.currentTarget.style.opacity = '1';
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }, []);
  const onDragLeave = useCallback(() => setDragOverIndex(null), []);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (touchIndexRef.current === null || touchStartRef.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartRef.current;
    const fromIndex = touchIndexRef.current;
    // a swipe of 30 px or more moves the row one place
    if (Math.abs(diff) > 30) {
      const toIndex = fromIndex + (diff > 0 ? 1 : -1);
      if (toIndex >= 0 && toIndex < count) onReorder?.(fromIndex, toIndex);
    }
    touchStartRef.current = null;
    touchIndexRef.current = null;
  }, [count, onReorder]);

  /** What a row needs to be dragged (nothing when `enabled` is false) */
  const itemProps = (index: number, enabled = true) => (enabled ? {
    draggable: true,
    onDragStart: (e: React.DragEvent<HTMLElement>) => {
      dragIndexRef.current = index;
      e.dataTransfer.effectAllowed = 'move';
      e.currentTarget.style.opacity = '0.5';
    },
    onDragEnd,
    onDragOver: (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragIndexRef.current !== null && dragIndexRef.current !== index) setDragOverIndex(index);
    },
    onDragLeave,
    onDrop: (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      const fromIndex = dragIndexRef.current;
      if (fromIndex !== null && fromIndex !== index) onReorder?.(fromIndex, index);
      dragIndexRef.current = null;
      setDragOverIndex(null);
    },
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      if (handleOnly && !(e.target as Element | null)?.closest?.('[data-drag-handle]')) return;
      touchStartRef.current = e.touches[0].clientY;
      touchIndexRef.current = index;
    },
    onTouchEnd,
  } : {});

  return { dragOverIndex, itemProps };
}

/** The mark a row being dragged over shows: a line where it will land */
export const DRAG_OVER_CLASS = 'bg-white/[0.08] shadow-[inset_0_2px_0_rgba(255,92,214,0.75)]';

/** A draggable row's handle (☰), or its place in the list where it cannot be dragged */
export const DragHandle = ({ enabled, position, className = '' }: { enabled: boolean; position: number; className?: string }) => {
  const { t } = useTranslation();
  return (
    <span
      data-drag-handle={enabled ? '' : undefined}
      className={`w-4 text-center text-xs flex-shrink-0 select-none ${enabled ? 'text-white/35 hover:text-white/60 cursor-grab active:cursor-grabbing touch-none' : 'text-white/40 tabular-nums'} ${className}`}
      title={enabled ? t('queue.dragToReorder') : undefined}
    >
      {enabled ? <>&#9776;</> : position}
    </span>
  );
};
