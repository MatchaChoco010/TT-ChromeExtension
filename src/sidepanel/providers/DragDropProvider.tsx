import React, { createContext, useContext, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragDropCallbacks } from '@/types';

interface DragDropContextType {
  callbacks: DragDropCallbacks;
}

const DragDropContext = createContext<DragDropContextType | undefined>(
  undefined
);

export const useDragDropContext = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error(
      'useDragDropContext must be used within DragDropProvider'
    );
  }
  return context;
};

interface DragDropProviderProps {
  children: React.ReactNode;
  callbacks: DragDropCallbacks;
}

export const DragDropProvider: React.FC<DragDropProviderProps> = ({
  children,
  callbacks,
}) => {
  // ポインターセンサーとキーボードセンサーを設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動したらドラッグ開始
      },
    }),
    useSensor(KeyboardSensor)
  );

  // コンテキストの値をメモ化
  const contextValue = useMemo(
    () => ({
      callbacks,
    }),
    [callbacks]
  );

  return (
    <DragDropContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={callbacks.onDragStart}
        onDragOver={callbacks.onDragOver}
        onDragEnd={callbacks.onDragEnd}
        onDragCancel={callbacks.onDragCancel}
      >
        {children}
      </DndContext>
    </DragDropContext.Provider>
  );
};

export default DragDropProvider;
