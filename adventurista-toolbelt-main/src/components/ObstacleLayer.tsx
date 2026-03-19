import { useState, useCallback, useRef } from 'react';
import { Obstacle, ObstacleLine, ObstacleRect, makeId } from '@/lib/obstacles';

export type ObstacleTool = 'select' | 'line' | 'rect' | null;

interface ObstacleLayerProps {
  obstacles: Obstacle[];
  setObstacles: (obs: Obstacle[]) => void;
  tool: ObstacleTool;
  imgSize: { w: number; h: number };
  zoom: number;
  pan: { x: number; y: number };
  isDM: boolean;
  showForPlayer?: boolean; // DM preview mode
}

interface DragState {
  type: 'draw-line' | 'draw-rect' | 'move' | 'resize';
  startX: number;
  startY: number;
  obstacleId?: string;
  resizeHandle?: string;
  origObstacle?: Obstacle;
}

export function ObstacleLayer({
  obstacles, setObstacles, tool, imgSize, zoom, pan, isDM, showForPlayer,
}: ObstacleLayerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toLocal = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, [zoom]);

  const handlePointerDown = useCallback((e: React.MouseEvent) => {
    if (!isDM || showForPlayer) return;
    e.stopPropagation();
    const p = toLocal(e);

    if (tool === 'line' || tool === 'rect') {
      setDragState({ type: tool === 'line' ? 'draw-line' : 'draw-rect', startX: p.x, startY: p.y });
      setPreview({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      setSelectedId(null);
    } else if (tool === 'select') {
      // Check if clicking on an obstacle
      const hit = hitTest(p.x, p.y, obstacles);
      if (hit) {
        setSelectedId(hit.id);
        const handle = getResizeHandle(p.x, p.y, hit);
        if (handle) {
          setDragState({ type: 'resize', startX: p.x, startY: p.y, obstacleId: hit.id, resizeHandle: handle, origObstacle: { ...hit } });
        } else {
          setDragState({ type: 'move', startX: p.x, startY: p.y, obstacleId: hit.id, origObstacle: { ...hit } });
        }
      } else {
        setSelectedId(null);
      }
    }
  }, [isDM, showForPlayer, tool, obstacles, toLocal]);

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;
    e.stopPropagation();
    const p = toLocal(e);

    if (dragState.type === 'draw-line' || dragState.type === 'draw-rect') {
      setPreview({ x1: dragState.startX, y1: dragState.startY, x2: p.x, y2: p.y });
    } else if (dragState.type === 'move' && dragState.obstacleId && dragState.origObstacle) {
      const dx = p.x - dragState.startX;
      const dy = p.y - dragState.startY;
      setObstacles(obstacles.map(o => {
        if (o.id !== dragState.obstacleId) return o;
        if (o.type === 'line') {
          const orig = dragState.origObstacle as ObstacleLine;
          return { ...o, x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy };
        } else {
          const orig = dragState.origObstacle as ObstacleRect;
          return { ...o, x: orig.x + dx, y: orig.y + dy } as ObstacleRect;
        }
      }));
    } else if (dragState.type === 'resize' && dragState.obstacleId && dragState.origObstacle) {
      const dx = p.x - dragState.startX;
      const dy = p.y - dragState.startY;
      setObstacles(obstacles.map(o => {
        if (o.id !== dragState.obstacleId) return o;
        if (o.type === 'line') {
          const orig = dragState.origObstacle as ObstacleLine;
          if (dragState.resizeHandle === 'start') {
            return { ...o, x1: orig.x1 + dx, y1: orig.y1 + dy };
          } else {
            return { ...o, x2: orig.x2 + dx, y2: orig.y2 + dy };
          }
        } else {
          const orig = dragState.origObstacle as ObstacleRect;
          const h = dragState.resizeHandle!;
          let { x, y, w, h: height } = orig;
          if (h.includes('e')) w = orig.w + dx;
          if (h.includes('w')) { x = orig.x + dx; w = orig.w - dx; }
          if (h.includes('s')) height = orig.h + dy;
          if (h.includes('n')) { y = orig.y + dy; height = orig.h - dy; }
          // Normalize negative dimensions
          if (w < 0) { x += w; w = -w; }
          if (height < 0) { y += height; height = -height; }
          return { ...o, x, y, w, h: height } as ObstacleRect;
        }
      }));
    }
  }, [dragState, toLocal, obstacles, setObstacles]);

  const handlePointerUp = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;
    e.stopPropagation();

    if ((dragState.type === 'draw-line' || dragState.type === 'draw-rect') && preview) {
      const dx = preview.x2 - preview.x1;
      const dy = preview.y2 - preview.y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        if (dragState.type === 'draw-line') {
          const newObs: ObstacleLine = {
            id: makeId(), type: 'line',
            x1: preview.x1, y1: preview.y1, x2: preview.x2, y2: preview.y2,
            blocksVision: true, blocksMovement: false,
          };
          setObstacles([...obstacles, newObs]);
          setSelectedId(newObs.id);
        } else {
          const x = Math.min(preview.x1, preview.x2);
          const y = Math.min(preview.y1, preview.y2);
          const w = Math.abs(dx);
          const h = Math.abs(dy);
          const newObs: ObstacleRect = {
            id: makeId(), type: 'rect', x, y, w, h,
            blocksVision: true, blocksMovement: false,
          };
          setObstacles([...obstacles, newObs]);
          setSelectedId(newObs.id);
        }
      }
    }
    setDragState(null);
    setPreview(null);
  }, [dragState, preview, obstacles, setObstacles]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setObstacles(obstacles.filter(o => o.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, obstacles, setObstacles]);

  const toggleProp = useCallback((prop: 'blocksVision' | 'blocksMovement') => {
    if (!selectedId) return;
    setObstacles(obstacles.map(o =>
      o.id === selectedId ? { ...o, [prop]: !o[prop] } : o
    ));
  }, [selectedId, obstacles, setObstacles]);

  // Handle keyboard delete
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
      deleteSelected();
    }
  }, [selectedId, deleteSelected]);

  const selected = selectedId ? obstacles.find(o => o.id === selectedId) : null;

  // Only show obstacle layer for DM
  if (!isDM && !showForPlayer) return null;

  const isInteractive = isDM && !showForPlayer && tool !== null;

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0"
        width={imgSize.w}
        height={imgSize.h}
        style={{
          pointerEvents: isInteractive ? 'auto' : 'none',
          zIndex: 15,
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
      >
        {/* Render obstacles */}
        {obstacles.map(obs => {
          const isSelected = obs.id === selectedId;
          const strokeColor = obs.blocksVision
            ? 'hsl(0, 72%, 51%)'
            : 'hsl(45, 93%, 47%)';
          const opacity = showForPlayer ? 0 : (isDM ? 0.7 : 0);

          if (obs.type === 'line') {
            return (
              <g key={obs.id}>
                <line
                  x1={obs.x1} y1={obs.y1} x2={obs.x2} y2={obs.y2}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 4 : 3}
                  opacity={opacity}
                  strokeDasharray={obs.blocksMovement ? undefined : '6 3'}
                />
                {/* Wider hit area */}
                <line
                  x1={obs.x1} y1={obs.y1} x2={obs.x2} y2={obs.y2}
                  stroke="transparent"
                  strokeWidth={12}
                />
                {isSelected && isDM && !showForPlayer && (
                  <>
                    <circle cx={obs.x1} cy={obs.y1} r={5} fill="hsl(var(--foreground))" opacity={0.8} />
                    <circle cx={obs.x2} cy={obs.y2} r={5} fill="hsl(var(--foreground))" opacity={0.8} />
                  </>
                )}
              </g>
            );
          } else {
            return (
              <g key={obs.id}>
                <rect
                  x={obs.x} y={obs.y} width={obs.w} height={obs.h}
                  fill={`${strokeColor.replace(')', ' / 0.15)')}`}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  opacity={opacity}
                  strokeDasharray={obs.blocksMovement ? undefined : '6 3'}
                />
                {/* Hit area */}
                <rect
                  x={obs.x} y={obs.y} width={obs.w} height={obs.h}
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={8}
                />
                {isSelected && isDM && !showForPlayer && (
                  <>
                    {/* Resize handles: corners */}
                    {[
                      { hx: obs.x, hy: obs.y, handle: 'nw' },
                      { hx: obs.x + obs.w, hy: obs.y, handle: 'ne' },
                      { hx: obs.x + obs.w, hy: obs.y + obs.h, handle: 'se' },
                      { hx: obs.x, hy: obs.y + obs.h, handle: 'sw' },
                    ].map(({ hx, hy, handle }) => (
                      <rect
                        key={handle}
                        x={hx - 4} y={hy - 4} width={8} height={8}
                        fill="hsl(var(--foreground))" opacity={0.8}
                      />
                    ))}
                  </>
                )}
              </g>
            );
          }
        })}

        {/* Draw preview */}
        {preview && dragState && (
          dragState.type === 'draw-line' ? (
            <line
              x1={preview.x1} y1={preview.y1} x2={preview.x2} y2={preview.y2}
              stroke="hsl(0, 72%, 51%)"
              strokeWidth={2}
              opacity={0.6}
              strokeDasharray="4 4"
            />
          ) : (
            <rect
              x={Math.min(preview.x1, preview.x2)}
              y={Math.min(preview.y1, preview.y2)}
              width={Math.abs(preview.x2 - preview.x1)}
              height={Math.abs(preview.y2 - preview.y1)}
              fill="hsl(0, 72%, 51% / 0.1)"
              stroke="hsl(0, 72%, 51%)"
              strokeWidth={2}
              opacity={0.6}
              strokeDasharray="4 4"
            />
          )
        )}
      </svg>

      {/* Selected obstacle properties panel */}
      {selected && isDM && !showForPlayer && (
        <div
          className="absolute top-2 left-2 bg-card border border-border rounded p-2 z-50 flex flex-col gap-1"
          style={{ pointerEvents: 'auto' }}
        >
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
            {selected.type === 'line' ? 'Line' : 'Rectangle'} Obstacle
          </p>
          <label className="flex items-center gap-2 text-[10px] font-mono text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={selected.blocksVision}
              onChange={() => toggleProp('blocksVision')}
              className="accent-destructive"
            />
            Blocks Vision
          </label>
          <label className="flex items-center gap-2 text-[10px] font-mono text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={selected.blocksMovement}
              onChange={() => toggleProp('blocksMovement')}
              className="accent-destructive"
            />
            Blocks Movement
          </label>
          <button
            onClick={deleteSelected}
            className="text-[9px] uppercase font-bold text-destructive hover:underline mt-1 text-left"
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}

// Hit testing
function hitTest(x: number, y: number, obstacles: Obstacle[]): Obstacle | null {
  // Check in reverse order (top-most first)
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    if (obs.type === 'line') {
      if (distToSegment(x, y, obs.x1, obs.y1, obs.x2, obs.y2) < 8) return obs;
    } else {
      if (x >= obs.x - 4 && x <= obs.x + obs.w + 4 && y >= obs.y - 4 && y <= obs.y + obs.h + 4) return obs;
    }
  }
  return null;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

function getResizeHandle(x: number, y: number, obs: Obstacle): string | null {
  const threshold = 8;
  if (obs.type === 'line') {
    if (Math.sqrt((x - obs.x1) ** 2 + (y - obs.y1) ** 2) < threshold) return 'start';
    if (Math.sqrt((x - obs.x2) ** 2 + (y - obs.y2) ** 2) < threshold) return 'end';
    return null;
  }
  // Rect corners
  const corners = [
    { handle: 'nw', cx: obs.x, cy: obs.y },
    { handle: 'ne', cx: obs.x + obs.w, cy: obs.y },
    { handle: 'se', cx: obs.x + obs.w, cy: obs.y + obs.h },
    { handle: 'sw', cx: obs.x, cy: obs.y + obs.h },
  ];
  for (const c of corners) {
    if (Math.sqrt((x - c.cx) ** 2 + (y - c.cy) ** 2) < threshold) return c.handle;
  }
  return null;
}
