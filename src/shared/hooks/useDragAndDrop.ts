// Custom hook for drag and drop functionality

import { useState } from 'react';

/**
 * Generic drag and drop hook
 * @returns drag state and handlers
 */
export function useDragAndDrop<T = string>() {
  const [draggedItem, setDraggedItem] = useState<T | null>(null);

  const handleDragStart = (item: T) => {
    setDraggedItem(item);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  return {
    draggedItem,
    handleDragStart,
    handleDragEnd,
    isDragging: draggedItem !== null
  };
}

/**
 * Hook for reordering items in an array via drag and drop
 */
export function useArrayReorder<T extends { id: string }>(
  items: T[],
  onReorder: (newItems: T[]) => void
) {
  const { draggedItem, handleDragStart, handleDragEnd } = useDragAndDrop<string>();

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    const draggedIndex = items.findIndex(item => item.id === draggedItem);
    const targetIndex = items.findIndex(item => item.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);

    onReorder(newItems);
  };

  return {
    draggedItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd
  };
}
