import { useMemo } from 'react';
import { Obstacle } from '@/lib/obstacles';
import { isCellVisible } from '@/lib/visibility';

interface FogOfWarLayerProps {
  gridSize: number;
  gridCols: number;
  gridRows: number;
  imgSize: { w: number; h: number };
  viewers: { x: number; y: number; visionRadius: number }[];
  obstacles: Obstacle[];
  isDM: boolean;
  showPlayerPreview: boolean;
}

export function FogOfWarLayer({
  gridSize, gridCols, gridRows, viewers, obstacles, isDM, showPlayerPreview,
}: FogOfWarLayerProps) {
  const visibleCells = useMemo(() => {
    const visible = new Set<string>();
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (isCellVisible(c, r, gridSize, viewers, obstacles)) {
          visible.add(`${c},${r}`);
        }
      }
    }
    return visible;
  }, [gridSize, gridCols, gridRows, viewers, obstacles]);

  // DM sees everything unless previewing player vision
  const showFog = !isDM || showPlayerPreview;
  if (!showFog) return null;

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 25 }}>
      {Array.from({ length: gridRows }, (_, row) =>
        Array.from({ length: gridCols }, (_, col) => {
          const key = `${col},${row}`;
          const visible = visibleCells.has(key);
          if (visible) return null;
          return (
            <div
              key={key}
              className="absolute"
              style={{
                left: col * gridSize,
                top: row * gridSize,
                width: gridSize,
                height: gridSize,
                backgroundColor: showPlayerPreview
                  ? 'hsl(var(--background) / 0.6)'
                  : 'hsl(var(--background) / 0.95)',
              }}
            />
          );
        })
      )}
    </div>
  );
}
