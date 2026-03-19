// Line-of-sight and visibility calculations
import { Obstacle, getObstacleSegments } from './obstacles';

/** Check if two line segments intersect */
function segmentsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  const d1x = ax2 - ax1, d1y = ay2 - ay1;
  const d2x = bx2 - bx1, d2y = by2 - by1;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;

  const dx = bx1 - ax1, dy = by1 - ay1;
  const t = (dx * d2y - dy * d2x) / cross;
  const u = (dx * d1y - dy * d1x) / cross;

  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

/** Check if a ray from origin to target is blocked by any vision-blocking obstacle */
export function isBlocked(
  ox: number, oy: number,
  tx: number, ty: number,
  obstacles: Obstacle[],
): boolean {
  for (const obs of obstacles) {
    if (!obs.blocksVision) continue;
    const segments = getObstacleSegments(obs);
    for (const [x1, y1, x2, y2] of segments) {
      if (segmentsIntersect(ox, oy, tx, ty, x1, y1, x2, y2)) {
        return true;
      }
    }
  }
  return false;
}

/** Check if a point is within vision radius and has line of sight */
export function isVisible(
  px: number, py: number,
  viewers: { x: number; y: number; visionRadius: number }[],
  obstacles: Obstacle[],
): boolean {
  for (const v of viewers) {
    const dist = Math.sqrt((px - v.x) ** 2 + (py - v.y) ** 2);
    if (dist > v.visionRadius) continue;
    if (!isBlocked(v.x, v.y, px, py, obstacles)) return true;
  }
  return false;
}

/** Check if a grid cell center is visible to any viewer */
export function isCellVisible(
  col: number, row: number, gridSize: number,
  viewers: { x: number; y: number; visionRadius: number }[],
  obstacles: Obstacle[],
): boolean {
  const cx = col * gridSize + gridSize / 2;
  const cy = row * gridSize + gridSize / 2;
  return isVisible(cx, cy, viewers, obstacles);
}

/** Check if movement between two points crosses a movement-blocking obstacle */
export function isMovementBlocked(
  ox: number, oy: number,
  tx: number, ty: number,
  obstacles: Obstacle[],
): boolean {
  for (const obs of obstacles) {
    if (!obs.blocksMovement) continue;
    const segments = getObstacleSegments(obs);
    for (const [x1, y1, x2, y2] of segments) {
      if (segmentsIntersect(ox, oy, tx, ty, x1, y1, x2, y2)) {
        return true;
      }
    }
  }
  return false;
}
