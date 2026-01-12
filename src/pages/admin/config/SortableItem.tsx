import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import type { UseSortableArguments } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Active, Over } from '@dnd-kit/core';
import type { Transform } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  children: (props: {
    attributes: ReturnType<typeof useSortable>['attributes'];
    listeners: ReturnType<typeof useSortable>['listeners'];
    setNodeRef: (node: HTMLElement | null) => void;
    transform: Transform | null;
    transition: string | undefined;
    isDragging: boolean;
  }) => React.ReactNode;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
      })}
    </div>

  );
}