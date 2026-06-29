import React, { createContext, useContext } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import IconButton from "@mui/material/IconButton";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

type SortableItemContextValue = ReturnType<typeof useSortable>;

const SortableItemContext = createContext<SortableItemContextValue | null>(
  null,
);

function useSortableItemContext() {
  const context = useContext(SortableItemContext);
  if (!context) {
    throw new Error("SortableDragHandle must be used within SortableItem");
  }
  return context;
}

type SortableItemProps = {
  id: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Restrict dragging to SortableDragHandle children. */
  dragHandle?: boolean;
};

export function SortableItem({
  id,
  style,
  children,
  dragHandle = false,
}: SortableItemProps) {
  const sortable = useSortable({ id });
  const {
    attributes,
    listeners,
    setNodeRef,
    setDraggableNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const styleProps = {
    ...(style || {}),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <SortableItemContext.Provider value={sortable}>
      {dragHandle ? (
        <div ref={setNodeRef} style={styleProps}>
          {children}
        </div>
      ) : (
        <div
          ref={setNodeRef}
          style={styleProps}
          {...attributes}
          {...listeners}
        >
          {children}
        </div>
      )}
    </SortableItemContext.Provider>
  );
}

export function SortableDragHandle() {
  const { attributes, listeners, setDraggableNodeRef } =
    useSortableItemContext();

  return (
    <IconButton
      ref={setDraggableNodeRef}
      size="small"
      sx={{ p: 0.25, cursor: "grab", touchAction: "none" }}
      aria-label="Reorder"
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
    >
      <DragIndicatorIcon sx={{ fontSize: "1rem", opacity: 0.5 }} />
    </IconButton>
  );
}
