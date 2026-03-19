// Obstacle types and persistence for map tools

export interface ObstacleLine {
  id: string;
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocksVision: boolean;
  blocksMovement: boolean;
}

export interface ObstacleRect {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  blocksVision: boolean;
  blocksMovement: boolean;
}

export type Obstacle = ObstacleLine | ObstacleRect;

export function loadObstacles(mapId: string): Obstacle[] {
  const data = localStorage.getItem(`map-obstacles-${mapId}`);
  return data ? JSON.parse(data) : [];
}

export function saveObstacles(mapId: string, obstacles: Obstacle[]) {
  localStorage.setItem(`map-obstacles-${mapId}`, JSON.stringify(obstacles));
}

export function makeId(): string {
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Get all line segments from an obstacle (rects produce 4 edges) */
export function getObstacleSegments(obs: Obstacle): [number, number, number, number][] {
  if (obs.type === 'line') {
    return [[obs.x1, obs.y1, obs.x2, obs.y2]];
  }
  const { x, y, w, h } = obs;
  return [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y],
  ];
}
