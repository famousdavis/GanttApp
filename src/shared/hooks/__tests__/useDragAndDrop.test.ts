import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragAndDrop, useArrayReorder } from '../useDragAndDrop';

describe('useDragAndDrop', () => {
  it('initializes with null draggedItem and isDragging false', () => {
    const { result } = renderHook(() => useDragAndDrop<string>());
    expect(result.current.draggedItem).toBeNull();
    expect(result.current.isDragging).toBe(false);
  });

  it('sets draggedItem on handleDragStart', () => {
    const { result } = renderHook(() => useDragAndDrop<string>());

    act(() => {
      result.current.handleDragStart('item-1');
    });

    expect(result.current.draggedItem).toBe('item-1');
    expect(result.current.isDragging).toBe(true);
  });

  it('clears draggedItem on handleDragEnd', () => {
    const { result } = renderHook(() => useDragAndDrop<string>());

    act(() => {
      result.current.handleDragStart('item-1');
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handleDragEnd();
    });
    expect(result.current.draggedItem).toBeNull();
    expect(result.current.isDragging).toBe(false);
  });

  it('works with numeric types', () => {
    const { result } = renderHook(() => useDragAndDrop<number>());

    act(() => {
      result.current.handleDragStart(42);
    });

    expect(result.current.draggedItem).toBe(42);
  });
});

describe('useArrayReorder', () => {
  const items = [
    { id: 'a', name: 'Item A' },
    { id: 'b', name: 'Item B' },
    { id: 'c', name: 'Item C' },
  ];

  it('initializes with null draggedItem', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));
    expect(result.current.draggedItem).toBeNull();
  });

  it('sets draggedItem on handleDragStart', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      result.current.handleDragStart('a');
    });

    expect(result.current.draggedItem).toBe('a');
  });

  it('reorders items when dragging over a different item', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      result.current.handleDragStart('a');
    });

    act(() => {
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.DragEvent;
      result.current.handleDragOver(mockEvent, 'c');
    });

    expect(onReorder).toHaveBeenCalledTimes(1);
    const reordered = onReorder.mock.calls[0][0];
    // 'a' was moved from index 0 to where 'c' was (index 2)
    expect(reordered.map((i: { id: string }) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not reorder when dragging over the same item', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      result.current.handleDragStart('a');
    });

    act(() => {
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.DragEvent;
      result.current.handleDragOver(mockEvent, 'a');
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not reorder when no item is being dragged', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.DragEvent;
      result.current.handleDragOver(mockEvent, 'b');
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not reorder when dragged item is not in array', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      result.current.handleDragStart('nonexistent');
    });

    act(() => {
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.DragEvent;
      result.current.handleDragOver(mockEvent, 'b');
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not reorder when target item is not in array', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      result.current.handleDragStart('a');
    });

    act(() => {
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.DragEvent;
      result.current.handleDragOver(mockEvent, 'nonexistent');
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('clears draggedItem on handleDragEnd', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      result.current.handleDragStart('a');
    });
    expect(result.current.draggedItem).toBe('a');

    act(() => {
      result.current.handleDragEnd();
    });
    expect(result.current.draggedItem).toBeNull();
  });

  it('does not mutate the original array', () => {
    const original = [...items];
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      result.current.handleDragStart('a');
    });

    act(() => {
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.DragEvent;
      result.current.handleDragOver(mockEvent, 'c');
    });

    // Original array should be unchanged
    expect(items).toEqual(original);
  });

  it('prevents default on drag over event', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useArrayReorder(items, onReorder));

    act(() => {
      result.current.handleDragStart('a');
    });

    const preventDefault = vi.fn();
    act(() => {
      const mockEvent = { preventDefault } as unknown as React.DragEvent;
      result.current.handleDragOver(mockEvent, 'b');
    });

    expect(preventDefault).toHaveBeenCalled();
  });
});
