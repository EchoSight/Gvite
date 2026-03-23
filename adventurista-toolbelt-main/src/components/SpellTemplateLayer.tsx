import type { SpellTemplate } from '@/lib/types';

interface SpellTemplateLayerProps {
  templates: SpellTemplate[];
  draftTemplate?: SpellTemplate | null;
  gridSize: number;
  ftPerCell: number;
  imgSize: { w: number; h: number };
}

function getDistanceInPixels(sizeFt: number, gridSize: number, ftPerCell: number): number {
  return (sizeFt / Math.max(ftPerCell, 1)) * gridSize;
}

function getTemplatePath(template: SpellTemplate, gridSize: number, ftPerCell: number): string | null {
  if (!template.target) return null;
  const lengthPx = getDistanceInPixels(template.sizeFt, gridSize, ftPerCell);
  const dx = template.target.x - template.origin.x;
  const dy = template.target.y - template.origin.y;
  const angle = Math.atan2(dy, dx);

  if (template.shape === 'line') {
    const widthPx = getDistanceInPixels(template.widthFt ?? 5, gridSize, ftPerCell) / 2;
    const endX = template.origin.x + Math.cos(angle) * lengthPx;
    const endY = template.origin.y + Math.sin(angle) * lengthPx;
    const perpendicularX = Math.cos(angle + Math.PI / 2) * widthPx;
    const perpendicularY = Math.sin(angle + Math.PI / 2) * widthPx;

    return [
      `M ${template.origin.x + perpendicularX} ${template.origin.y + perpendicularY}`,
      `L ${template.origin.x - perpendicularX} ${template.origin.y - perpendicularY}`,
      `L ${endX - perpendicularX} ${endY - perpendicularY}`,
      `L ${endX + perpendicularX} ${endY + perpendicularY}`,
      'Z',
    ].join(' ');
  }

  if (template.shape === 'cone') {
    const spread = Math.PI / 6;
    const leftAngle = angle - spread;
    const rightAngle = angle + spread;
    const leftX = template.origin.x + Math.cos(leftAngle) * lengthPx;
    const leftY = template.origin.y + Math.sin(leftAngle) * lengthPx;
    const rightX = template.origin.x + Math.cos(rightAngle) * lengthPx;
    const rightY = template.origin.y + Math.sin(rightAngle) * lengthPx;
    return `M ${template.origin.x} ${template.origin.y} L ${leftX} ${leftY} A ${lengthPx} ${lengthPx} 0 0 1 ${rightX} ${rightY} Z`;
  }

  return null;
}

function renderTemplate(template: SpellTemplate, gridSize: number, ftPerCell: number, isDraft = false) {
  const fill = template.color;
  const opacity = isDraft ? Math.min(template.opacity + 0.1, 0.45) : template.opacity;
  const strokeOpacity = Math.min(opacity + 0.35, 0.95);
  const sizePx = getDistanceInPixels(template.sizeFt, gridSize, ftPerCell);

  if (template.shape === 'circle') {
    return <circle cx={template.origin.x} cy={template.origin.y} r={sizePx} fill={fill} fillOpacity={opacity} stroke={fill} strokeWidth={2} strokeOpacity={strokeOpacity} />;
  }

  if (template.shape === 'square') {
    const half = sizePx / 2;
    return <rect x={template.origin.x - half} y={template.origin.y - half} width={sizePx} height={sizePx} fill={fill} fillOpacity={opacity} stroke={fill} strokeWidth={2} strokeOpacity={strokeOpacity} />;
  }

  const path = getTemplatePath(template, gridSize, ftPerCell);
  if (!path) return null;
  return <path d={path} fill={fill} fillOpacity={opacity} stroke={fill} strokeWidth={2} strokeOpacity={strokeOpacity} />;
}

export function SpellTemplateLayer({ templates, draftTemplate, gridSize, ftPerCell, imgSize }: SpellTemplateLayerProps) {
  return (
    <svg className="absolute inset-0 pointer-events-none" width={imgSize.w} height={imgSize.h}>
      {templates.map(template => (
        <g key={template.id}>
          {renderTemplate(template, gridSize, ftPerCell)}
          <text x={template.origin.x + 8} y={template.origin.y - 8} fill={template.color} fontSize="10" fontFamily="monospace">
            {template.label}
          </text>
        </g>
      ))}
      {draftTemplate && (
        <g>
          {renderTemplate(draftTemplate, gridSize, ftPerCell, true)}
          <text x={draftTemplate.origin.x + 8} y={draftTemplate.origin.y - 8} fill={draftTemplate.color} fontSize="10" fontFamily="monospace">
            {draftTemplate.label}
          </text>
        </g>
      )}
    </svg>
  );
}
