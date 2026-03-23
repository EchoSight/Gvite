import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ZoomIn, ZoomOut, RotateCcw, Plus, Trash2, X,
  Grid3X3, Eye, EyeOff, Minus, MousePointer, Move, Slash, Square,
} from 'lucide-react';
import { Character, MapToken, SpellTemplate } from '@/lib/types';
import { useGame } from '@/lib/GameContext';
import { InitiativeTracker, InitiativeEntry } from './InitiativeTracker';
import { CombatPanel } from './CombatPanel';
import type { Obstacle } from '@/lib/obstacles';
import { ObstacleLayer, ObstacleTool } from './ObstacleLayer';
import { FogOfWarLayer } from './FogOfWarLayer';
import { getCellFromPoint, getCellLabelFromPoint } from '@/lib/gridCoordinates';
import { isVisible, isMovementBlocked } from '@/lib/visibility';
import type { GridSettings } from '@/lib/repositories';
import { useMapSession } from '@/hooks/useMapSessions';
import { useMultiplayerSession } from '@/lib/MultiplayerSessionContext';
import { canControlToken } from '@/lib/playerOwnership';
import { createCombatTurnState, type CombatTurnState } from '@/lib/combat';
import { SPELL_CATALOG } from '@/lib/spellcasting';
import { SpellTemplateLayer } from './SpellTemplateLayer';


interface MapCanvasProps {
  mapImage: string;
  mapId: string;
  characters: Character[];
}

const MONSTER_PRESETS = [
  { label: 'Goblin', color: 'hsl(120, 60%, 35%)', hp: 7 },
  { label: 'Orc', color: 'hsl(30, 70%, 35%)', hp: 15 },
  { label: 'Dragon', color: 'hsl(0, 70%, 40%)', hp: 195 },
  { label: 'Skeleton', color: 'hsl(0, 0%, 60%)', hp: 13 },
  { label: 'Wolf', color: 'hsl(30, 30%, 40%)', hp: 11 },
  { label: 'Bandit', color: 'hsl(45, 50%, 35%)', hp: 11 },
];

const DEFAULT_GRID_SIZE = 40;
const DEFAULT_FT_PER_CELL = 5;
const DEFAULT_VISION_CELLS = 12; // 12 cells = 60ft default vision
const DEFAULT_GRID_OFFSET = { x: 0, y: 0 };
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.2;

export function MapCanvas({ mapImage, mapId, characters }: MapCanvasProps) {
  const { isDM } = useGame();
  const { playerId, linkedCharacterId } = useMultiplayerSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const defaultGridSettings = useMemo<GridSettings>(() => ({
    showGrid: true,
    gridSize: DEFAULT_GRID_SIZE,
    ftPerCell: DEFAULT_FT_PER_CELL,
    offsetX: DEFAULT_GRID_OFFSET.x,
    offsetY: DEFAULT_GRID_OFFSET.y,
  }), []);
  const { snapshot: mapSnapshot, dispatch } = useMapSession(mapId, defaultGridSettings);
  const { tokens, obstacles, spellTemplates } = mapSnapshot;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [gridSettings, setGridSettings] = useState<GridSettings>(() => mapSnapshot.gridSettings);
  const { showGrid, gridSize, ftPerCell } = gridSettings;
  const [gridOffset, setGridOffset] = useState(() => ({ x: gridSettings.offsetX, y: gridSettings.offsetY }));
  const [combatMovementUsed, setCombatMovementUsed] = useState(0);
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const areaSpellOptions = useMemo(() => SPELL_CATALOG.filter(spell => spell.area), []);
  const [selectedSpellTemplateId, setSelectedSpellTemplateId] = useState(() => areaSpellOptions[0]?.id ?? '');
  const [placingSpellTemplate, setPlacingSpellTemplate] = useState(false);
  const [placingTemplateOrigin, setPlacingTemplateOrigin] = useState<{ x: number; y: number } | null>(null);
  const [draftSpellTemplate, setDraftSpellTemplate] = useState<SpellTemplate | null>(null);

  // Obstacles
  const [obstacleTool, setObstacleTool] = useState<ObstacleTool>(null);

  // DM preview player vision
  const [showPlayerPreview, setShowPlayerPreview] = useState(false);

  // Combat state
  const [initiativeEntries, setInitiativeEntries] = useState<InitiativeEntry[]>([]);
  const [combatActive, setCombatActive] = useState(false);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [combatMoving, setCombatMoving] = useState(false);
  const [combatTurnStates, setCombatTurnStates] = useState<Record<string, CombatTurnState>>({});

  const charactersRef = useRef<Character[]>(characters);

  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  const currentTurnId = combatActive && initiativeEntries.length > 0
    ? initiativeEntries[currentTurnIndex]?.tokenId
    : null;

  useEffect(() => {
    setGridSettings(mapSnapshot.gridSettings);
  }, [mapSnapshot.gridSettings]);

  useEffect(() => {
    setGridOffset({ x: mapSnapshot.gridSettings.offsetX, y: mapSnapshot.gridSettings.offsetY });
  }, [mapSnapshot.gridSettings.offsetX, mapSnapshot.gridSettings.offsetY]);

  const handleImgLoad = () => {
    if (imgRef.current) {
      setImgSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  };

  const gridCols = Math.ceil((imgSize.w - gridOffset.x) / gridSize) + 1;
  const gridRows = Math.ceil((imgSize.h - gridOffset.y) / gridSize) + 1;
  const resolvedTokens = useMemo(() => tokens.map(token => {
    if (token.type !== 'character') return token;

    const linkedCharacter = charactersRef.current.find(character =>
      character.id === token.characterId || character.name === token.label,
    );

    if (!linkedCharacter) return token;

    return {
      ...token,
      characterId: token.characterId ?? linkedCharacter.id,
      ownerPlayerId: token.ownerPlayerId ?? linkedCharacter.ownerPlayerId,
    };
  }), [tokens]);

  // Vision viewers: all player character tokens
  const viewers = useMemo(() => {
    return resolvedTokens
      .filter(t => t.type === 'character')
      .map(t => ({
        x: t.x,
        y: t.y,
        visionRadius: t.visionRadius ?? (DEFAULT_VISION_CELLS * gridSize),
      }));
  }, [resolvedTokens, gridSize]);

  // Visibility check for tokens (player view)
  const isTokenVisible = useCallback((token: MapToken): boolean => {
    if (isDM && !showPlayerPreview) return true;
    if (token.type === 'character') return true; // Players always see their own tokens
    return isVisible(token.x, token.y, viewers, obstacles);
  }, [isDM, showPlayerPreview, viewers, obstacles]);


  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const rawX = (clientX - rect.left - pan.x) / zoom;
    const rawY = (clientY - rect.top - pan.y) / zoom;

    if (!showGrid) {
      return { x: rawX, y: rawY };
    }

    const cell = getCellFromPoint(rawX, rawY, {
      ...gridSettings,
      offsetX: gridOffset.x,
      offsetY: gridOffset.y,
    });

    return {
      x: gridOffset.x + (cell.col * gridSize) + gridSize / 2,
      y: gridOffset.y + (cell.row * gridSize) + gridSize / 2,
    };
  }, [gridOffset.x, gridOffset.y, gridSettings, gridSize, pan.x, pan.y, showGrid, zoom]);

  const selectedAreaSpell = useMemo(
    () => areaSpellOptions.find(spell => spell.id === selectedSpellTemplateId) ?? areaSpellOptions[0] ?? null,
    [areaSpellOptions, selectedSpellTemplateId],
  );

  const buildSpellTemplate = useCallback((origin: { x: number; y: number }, target?: { x: number; y: number } | null): SpellTemplate | null => {
    if (!selectedAreaSpell?.area) return null;

    return {
      id: `spell-template-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      spellId: selectedAreaSpell.id,
      label: selectedAreaSpell.name,
      shape: selectedAreaSpell.area.shape,
      origin,
      target: target ?? undefined,
      sizeFt: selectedAreaSpell.area.sizeFt,
      widthFt: selectedAreaSpell.area.widthFt,
      color: selectedAreaSpell.concentration ? 'hsl(280, 85%, 65%)' : 'hsl(12, 90%, 60%)',
      opacity: 0.22,
      casterTokenId: selectedToken ?? undefined,
      casterCharacterId: resolvedTokens.find(token => token.id === selectedToken)?.characterId,
      concentrationLinked: selectedAreaSpell.concentration,
      createdAt: new Date().toISOString(),
    };
  }, [resolvedTokens, selectedAreaSpell, selectedToken]);

  const clearTemplatePlacement = useCallback(() => {
    setPlacingSpellTemplate(false);
    setPlacingTemplateOrigin(null);
    setDraftSpellTemplate(null);
  }, []);

  const snapToGrid = useCallback((value: number, axis: 'x' | 'y') => {
    const offset = axis === 'x' ? gridOffset.x : gridOffset.y;
    return Math.round((value - offset) / gridSize) * gridSize + offset;
  }, [gridOffset.x, gridOffset.y, gridSize]);

  const updateGridSettings = useCallback((updater: (current: GridSettings) => GridSettings) => {
    const next = updater({
      ...mapSnapshot.gridSettings,
      offsetX: gridOffset.x,
      offsetY: gridOffset.y,
    });
    dispatch({ type: 'map:grid_update', gridSettings: next });
  }, [dispatch, gridOffset.x, gridOffset.y, mapSnapshot.gridSettings]);

  const nudgeGrid = useCallback((axis: 'x' | 'y', delta: number) => {
    const nextOffset = {
      x: gridOffset.x + (axis === 'x' ? delta : 0),
      y: gridOffset.y + (axis === 'y' ? delta : 0),
    };
    dispatch({
      type: 'map:grid_update',
      gridSettings: {
        ...mapSnapshot.gridSettings,
        offsetX: nextOffset.x,
        offsetY: nextOffset.y,
      },
    });
  }, [dispatch, gridOffset.x, gridOffset.y, mapSnapshot.gridSettings]);

  const resetGridAlignment = useCallback(() => {
    dispatch({
      type: 'map:grid_update',
      gridSettings: {
        ...mapSnapshot.gridSettings,
        offsetX: DEFAULT_GRID_OFFSET.x,
        offsetY: DEFAULT_GRID_OFFSET.y,
      },
    });
  }, [dispatch, mapSnapshot.gridSettings]);

  const handleObstaclesChange = useCallback((nextObstacles: Obstacle[]) => {
    dispatch({ type: 'map:obstacles_replace', obstacles: nextObstacles });
  }, [dispatch]);

  const clampZoom = useCallback((value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)), []);

  const handleZoomChange = useCallback((value: number) => {
    setZoom(clampZoom(value));
  }, [clampZoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(current => clampZoom(current + delta));
  }, [clampZoom]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (draggingToken || obstacleTool || placingSpellTemplate) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan, draggingToken, obstacleTool, placingSpellTemplate]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (placingSpellTemplate && placingTemplateOrigin && selectedAreaSpell?.area && (selectedAreaSpell.area.shape === 'cone' || selectedAreaSpell.area.shape === 'line')) {
      const point = getCanvasPoint(e.clientX, e.clientY);
      if (point) {
        setDraftSpellTemplate(buildSpellTemplate(placingTemplateOrigin, point));
      }
    }

    if (isPanning && !draggingToken) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [buildSpellTemplate, draggingToken, getCanvasPoint, isPanning, panStart, placingSpellTemplate, placingTemplateOrigin, selectedAreaSpell]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleTokenPointerDown = (e: React.PointerEvent, tokenId: string) => {
    if (obstacleTool) return; // Don't grab tokens while drawing obstacles
    e.stopPropagation();
    const token = resolvedTokens.find(t => t.id === tokenId);
    if (!token) return;
    if (!canControlToken(token, isDM, playerId)) return;

    if (combatActive) {
      setSelectedToken(tokenId);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    setDragOffset({ x: mouseX - token.x, y: mouseY - token.y });
    setDraggingToken(tokenId);
    setSelectedToken(tokenId);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleTokenPointerMove = (e: React.PointerEvent) => {
    if (!draggingToken) return;
    if (combatActive && draggingToken !== currentTurnId) {
      setDraggingToken(null);
      return;
    }
    const dragging = resolvedTokens.find(token => token.id === draggingToken);
    if (!dragging || !canControlToken(dragging, isDM, playerId)) {
      setDraggingToken(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    const newX = mouseX - dragOffset.x;
    const newY = mouseY - dragOffset.y;

    if (showGrid) {
      const nextCell = getCellFromPoint(newX, newY, {
        ...gridSettings,
        offsetX: gridOffset.x,
        offsetY: gridOffset.y,
      });
      dispatch({ type: 'map:token_move_cell', tokenId: draggingToken, cell: nextCell });
      return;
    }

    dispatch({ type: 'map:token_move', tokenId: draggingToken, x: newX, y: newY });
  };

  const handleTokenPointerUp = () => {
    setDraggingToken(null);
  };

  // Canvas click for combat movement
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isDM && placingSpellTemplate && selectedAreaSpell?.area) {
      const point = getCanvasPoint(e.clientX, e.clientY);
      if (point) {
        if (selectedAreaSpell.area.shape === 'circle' || selectedAreaSpell.area.shape === 'square') {
          const nextTemplate = buildSpellTemplate(point, null);
          if (nextTemplate) {
            dispatch({ type: 'map:spell_template_upsert', spellTemplate: nextTemplate });
          }
          clearTemplatePlacement();
          return;
        }

        if (!placingTemplateOrigin) {
          setPlacingTemplateOrigin(point);
          setDraftSpellTemplate(buildSpellTemplate(point, point));
          return;
        }

        const nextTemplate = buildSpellTemplate(placingTemplateOrigin, point);
        if (nextTemplate) {
          dispatch({ type: 'map:spell_template_upsert', spellTemplate: nextTemplate });
        }
        clearTemplatePlacement();
        return;
      }
    }

    if (!combatMoving || !currentTurnId) return;

    const activeToken = resolvedTokens.find(t => t.id === currentTurnId);
    if (!activeToken) return;
    if (!canControlToken(activeToken, isDM, playerId)) return;

    const point = getCanvasPoint(e.clientX, e.clientY);
    if (!point) return;

    const newX = point.x;
    const newY = point.y;

    if (isMovementBlocked(activeToken.x, activeToken.y, newX, newY, obstacles)) {
      return;
    }

    const dx = Math.abs(newX - activeToken.x) / gridSize;
    const dy = Math.abs(newY - activeToken.y) / gridSize;
    const cellsMoved = Math.max(dx, dy);
    const ftMoved = Math.round(cellsMoved) * ftPerCell;

    const charData = charactersRef.current.find(c => c.name === activeToken.label);
    const maxMovement = charData?.speed || 30;
    const remaining = maxMovement - combatMovementUsed;

    if (ftMoved > remaining) {
      return;
    }

    setCombatMovementUsed(prev => prev + ftMoved);
    moveToken(currentTurnId, newX, newY);
  };

  const moveToken = (tokenId: string, newX: number, newY: number) => {
    if (showGrid) {
      dispatch({
        type: 'map:token_move_cell',
        tokenId,
        cell: getCellFromPoint(newX, newY, {
          ...gridSettings,
          offsetX: gridOffset.x,
          offsetY: gridOffset.y,
        }),
      });
      return;
    }

    dispatch({ type: 'map:token_move', tokenId, x: newX, y: newY });
  };

  const damageToken = (tokenId: string, damage: number) => {
    dispatch({ type: 'map:token_damage', tokenId, damage });
  };

  const addCharacterToken = (char: Character) => {
    const token: MapToken = {
      id: `token-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: char.name,
      x: snapToGrid(200 + Math.random() * 100, 'x') + gridSize / 2,
      y: snapToGrid(200 + Math.random() * 100, 'y') + gridSize / 2,
      color: 'hsl(217, 91%, 60%)',
      icon: char.icon,
      type: 'character',
      hp: char.hp,
      maxHp: char.maxHp,
      visionRadius: DEFAULT_VISION_CELLS * gridSize,
      characterId: char.id,
      ownerPlayerId: char.ownerPlayerId,
    };
    dispatch({ type: 'map:token_upsert', token });
    setShowAddMenu(false);
  };

  const addMonsterToken = (preset: typeof MONSTER_PRESETS[0]) => {
    const token: MapToken = {
      id: `token-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: preset.label,
      x: snapToGrid(200 + Math.random() * 100, 'x') + gridSize / 2,
      y: snapToGrid(200 + Math.random() * 100, 'y') + gridSize / 2,
      color: preset.color,
      type: 'monster',
      hp: preset.hp,
      maxHp: preset.hp,
    };
    dispatch({ type: 'map:token_upsert', token });
    setShowAddMenu(false);
  };

  const removeToken = (id: string) => {
    dispatch({ type: 'map:token_remove', tokenId: id });
    if (selectedToken === id) setSelectedToken(null);
  };

  const updateTokenVision = (id: string, radiusCells: number) => {
    const token = resolvedTokens.find(t => t.id === id);
    if (!token) return;
    dispatch({
      type: 'map:token_upsert',
      token: {
        ...token,
        visionRadius: radiusCells * gridSize,
      },
    });
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleStartCombat = () => {
    if (initiativeEntries.length === 0) return;
    setCombatTurnStates(Object.fromEntries(initiativeEntries.map(entry => [entry.tokenId, createCombatTurnState()])));
    setCombatActive(true);
    setCurrentTurnIndex(0);
  };

  const handleNextTurn = () => {
    setCurrentTurnIndex(i => (i + 1) % initiativeEntries.length);
  };

  const handleResetCombat = () => {
    setCombatActive(false);
    setCurrentTurnIndex(0);
    setInitiativeEntries([]);
    setCombatTurnStates({});
  };

  const currentToken = selectedToken ? resolvedTokens.find(t => t.id === selectedToken) : null;
  const currentTurnToken = currentTurnId ? resolvedTokens.find(t => t.id === currentTurnId) : null;
  const canManageCurrentTurn = Boolean(currentTurnToken) && canControlToken(currentTurnToken, isDM, playerId);
  const linkedToken = linkedCharacterId
    ? resolvedTokens.find(token => token.type === 'character' && token.characterId === linkedCharacterId)
    : null;

  useEffect(() => {
    if (!canManageCurrentTurn) {
      setCombatMoving(false);
    }
  }, [canManageCurrentTurn]);

  const updateCombatTurnState = useCallback((tokenId: string, updater: (current: CombatTurnState) => CombatTurnState) => {
    setCombatTurnStates(current => ({
      ...current,
      [tokenId]: updater(current[tokenId] ?? createCombatTurnState()),
    }));
  }, []);

  return (
    <div className="relative w-full h-full flex">
      {/* Main canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 bg-card border-b border-border flex-wrap shrink-0">
          <button onClick={() => handleZoomChange(zoom + ZOOM_STEP)} className="tactical-card !p-1 px-2" title="Make map bigger">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => handleZoomChange(zoom - ZOOM_STEP)} className="tactical-card !p-1 px-2" title="Make map smaller">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetView} className="tactical-card !p-1 px-2" title="Reset">
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-2 min-w-[170px]">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold whitespace-nowrap">Map Size</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.1}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="h-1 flex-1 accent-secondary cursor-pointer"
              aria-label="Adjust map size"
            />
            <span className="font-mono text-[10px] text-muted-foreground w-10 text-right">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Grid toggle */}
          <button
            onClick={() => updateGridSettings(current => ({ ...current, showGrid: !current.showGrid }))}
            className={`tactical-card !p-1 px-2 flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold ${showGrid ? 'border-secondary text-secondary' : ''}`}
          >
            <Grid3X3 className="w-3 h-3" /> Grid
          </button>
          {showGrid && (
            <div className="flex items-center gap-1">
              <button onClick={() => updateGridSettings(current => ({ ...current, gridSize: Math.max(20, current.gridSize - 5) }))} className="tactical-card !p-1 px-1">
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono text-[9px] text-muted-foreground w-8 text-center">{gridSize}px</span>
              <button onClick={() => updateGridSettings(current => ({ ...current, gridSize: Math.min(100, current.gridSize + 5) }))} className="tactical-card !p-1 px-1">
                <Plus className="w-3 h-3" />
              </button>
              {isDM && (
                <>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button onClick={() => updateGridSettings(current => ({ ...current, ftPerCell: Math.max(5, current.ftPerCell - 5) }))} className="tactical-card !p-1 px-1">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono text-[9px] text-muted-foreground w-10 text-center">{ftPerCell}ft</span>
                  <button onClick={() => updateGridSettings(current => ({ ...current, ftPerCell: Math.min(30, current.ftPerCell + 5) }))} className="tactical-card !p-1 px-1">
                    <Plus className="w-3 h-3" />
                  </button>
                </>
              )}
              {isDM && (
                <>
                  <div className="w-px h-4 bg-border mx-1" />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => nudgeGrid('x', -1)}
                      className="tactical-card !p-1 px-1 font-mono text-[10px]"
                      title="Move grid left"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => nudgeGrid('y', -1)}
                      className="tactical-card !p-1 px-1 font-mono text-[10px]"
                      title="Move grid up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => nudgeGrid('y', 1)}
                      className="tactical-card !p-1 px-1 font-mono text-[10px]"
                      title="Move grid down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => nudgeGrid('x', 1)}
                      className="tactical-card !p-1 px-1 font-mono text-[10px]"
                      title="Move grid right"
                    >
                      →
                    </button>
                    <button
                      onClick={resetGridAlignment}
                      className="tactical-card !p-1 px-2 flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold"
                      title="Reset grid alignment"
                    >
                      <Move className="w-3 h-3" /> Align
                    </button>
                    <span className="font-mono text-[9px] text-muted-foreground w-16 text-center">{gridOffset.x},{gridOffset.y}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* DM Obstacle tools */}
          {isDM && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <button
                onClick={() => setObstacleTool(obstacleTool === 'select' ? null : 'select')}
                className={`tactical-card !p-1 px-2 flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold ${obstacleTool === 'select' ? 'border-secondary text-secondary' : ''}`}
                title="Select obstacle"
              >
                <MousePointer className="w-3 h-3" />
              </button>
              <button
                onClick={() => setObstacleTool(obstacleTool === 'line' ? null : 'line')}
                className={`tactical-card !p-1 px-2 flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold ${obstacleTool === 'line' ? 'border-secondary text-secondary' : ''}`}
                title="Draw line obstacle"
              >
                <Slash className="w-3 h-3" />
              </button>
              <button
                onClick={() => setObstacleTool(obstacleTool === 'rect' ? null : 'rect')}
                className={`tactical-card !p-1 px-2 flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold ${obstacleTool === 'rect' ? 'border-secondary text-secondary' : ''}`}
                title="Draw rectangle obstacle"
              >
                <Square className="w-3 h-3" />
              </button>

              <div className="w-px h-5 bg-border mx-1" />

              {/* Player vision preview */}
              <button
                onClick={() => setShowPlayerPreview(!showPlayerPreview)}
                className={`tactical-card !p-1 px-2 flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold ${showPlayerPreview ? 'border-accent text-accent' : ''}`}
                title="Preview player vision"
              >
                {showPlayerPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                Player View
              </button>
            </>
          )}


          {isDM && areaSpellOptions.length > 0 && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <div className="flex items-center gap-1">
                <select
                  value={selectedSpellTemplateId}
                  onChange={(event) => {
                    setSelectedSpellTemplateId(event.target.value);
                    setPlacingTemplateOrigin(null);
                    setDraftSpellTemplate(null);
                  }}
                  className="bg-transparent border border-border rounded-sm px-2 py-1 text-[10px] font-mono text-foreground"
                >
                  {areaSpellOptions.map(spell => (
                    <option key={spell.id} value={spell.id} className="bg-card">{spell.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (placingSpellTemplate) {
                      clearTemplatePlacement();
                      return;
                    }
                    setPlacingSpellTemplate(true);
                    setPlacingTemplateOrigin(null);
                    setDraftSpellTemplate(null);
                  }}
                  className={`tactical-card !p-1 px-2 text-[9px] uppercase tracking-wider font-bold ${placingSpellTemplate ? 'border-secondary text-secondary' : ''}`}
                  title="Place area spell"
                >
                  {placingSpellTemplate ? 'Cancel AoE' : 'AoE'}
                </button>
                {spellTemplates.length > 0 && (
                  <button
                    onClick={() => dispatch({ type: 'map:spell_templates_replace', spellTemplates: [] })}
                    className="tactical-card !p-1 px-2 text-[9px] uppercase tracking-wider font-bold"
                    title="Clear spell templates"
                  >
                    Clear AoE
                  </button>
                )}
              </div>
            </>
          )}

          <div className="flex-1" />

          {!isDM && (
            <div className="text-[10px] text-muted-foreground px-2">
              {linkedToken
                ? <>Linked token: <span className="font-mono text-foreground">{linkedToken.label}</span></>
                : 'Link a character to move its token.'}
            </div>
          )}

          {/* Add token (DM only) */}
          {isDM && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="tactical-card !p-1 px-3 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold"
              >
                <Plus className="w-3 h-3" /> Token
              </button>
              {showAddMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-sm shadow-xl z-50 max-h-64 overflow-y-auto">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-3 py-2 border-b border-border">Characters</p>
                  {charactersRef.current.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground px-3 py-2">No characters</p>
                  ) : (
                    charactersRef.current.map(c => (
                      <button
                        key={c.id}
                        onClick={() => addCharacterToken(c)}
                        className="w-full text-left px-3 py-2 text-xs font-mono text-foreground hover:bg-muted/50 flex items-center gap-2"
                      >
                        {c.icon ? (
                          <img src={c.icon} className="w-5 h-5 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[8px] text-secondary-foreground font-bold">
                            {c.name[0]}
                          </div>
                        )}
                        {c.name}
                      </button>
                    ))
                  )}
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-3 py-2 border-y border-border">Monsters</p>
                  {MONSTER_PRESETS.map(m => (
                    <button
                      key={m.label}
                      onClick={() => addMonsterToken(m)}
                      className="w-full text-left px-3 py-2 text-xs font-mono text-foreground hover:bg-muted/50 flex items-center gap-2"
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-background font-bold" style={{ backgroundColor: m.color }}>
                        {m.label[0]}
                      </div>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-hidden relative bg-muted/30 ${
            obstacleTool === 'line' || obstacleTool === 'rect' || placingSpellTemplate ? 'cursor-crosshair' :
            combatMoving ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
          }`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={(e) => { handlePointerMove(e); handleTokenPointerMove(e); }}
          onPointerUp={() => { handlePointerUp(); handleTokenPointerUp(); }}
          onClick={handleCanvasClick}
          style={{ touchAction: 'none' }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'relative',
              width: 'fit-content',
            }}
          >
            <img
              ref={imgRef}
              src={mapImage}
              alt="Campaign map"
              className="select-none pointer-events-none max-w-none"
              draggable={false}
              onLoad={handleImgLoad}
            />

            {/* Grid overlay */}
            {showGrid && (
              <svg
                className="absolute inset-0 pointer-events-none"
                width={imgSize.w}
                height={imgSize.h}
                style={{ opacity: 0.25 }}
              >
                {Array.from({ length: gridCols + 1 }, (_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={gridOffset.x + i * gridSize} y1={0}
                    x2={gridOffset.x + i * gridSize} y2={imgSize.h}
                    stroke="hsl(var(--foreground))"
                    strokeWidth={0.5}
                  />
                ))}
                {Array.from({ length: gridRows + 1 }, (_, i) => (
                  <line
                    key={`h-${i}`}
                    x1={0} y1={gridOffset.y + i * gridSize}
                    x2={imgSize.w} y2={gridOffset.y + i * gridSize}
                    stroke="hsl(var(--foreground))"
                    strokeWidth={0.5}
                  />
                ))}
              </svg>
            )}

            {/* Obstacle layer */}
            <ObstacleLayer
              obstacles={obstacles}
              setObstacles={handleObstaclesChange}
              tool={obstacleTool}
              imgSize={imgSize}
              zoom={zoom}
              isDM={isDM}
              showForPlayer={showPlayerPreview}
            />

            {/* Dynamic fog of war based on LOS */}
            <FogOfWarLayer
              gridSize={gridSize}
              gridCols={gridCols}
              gridRows={gridRows}
              imgSize={imgSize}
              viewers={viewers}
              obstacles={obstacles}
              isDM={isDM}
              showPlayerPreview={showPlayerPreview}
              gridOffset={gridOffset}
            />

            <SpellTemplateLayer
              templates={spellTemplates}
              draftTemplate={draftSpellTemplate}
              gridSize={gridSize}
              ftPerCell={ftPerCell}
              imgSize={imgSize}
            />

            {/* Tokens */}
            {resolvedTokens.map(token => {
              // Hide tokens not visible to players
              if (!isTokenVisible(token)) return null;

              const isCurrent = combatActive && token.id === currentTurnId;
              const isSelected = token.id === selectedToken;
              return (
                <div
                  key={token.id}
                  className="absolute group"
                  style={{
                    left: token.x - 18,
                    top: token.y - 18,
                    cursor: obstacleTool ? 'default' : 'move',
                    zIndex: isCurrent ? 30 : 20,
                  }}
                  onPointerDown={(e) => handleTokenPointerDown(e, token.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedToken(token.id); }}
                >
                  {isCurrent && (
                    <div className="absolute -inset-1.5 rounded-full border-2 border-secondary animate-pulse" />
                  )}
                  {isSelected && !isCurrent && (
                    <div className="absolute -inset-1 rounded-full border border-foreground/50" />
                  )}
                  {token.icon ? (
                    <img
                      src={token.icon}
                      className="w-9 h-9 rounded-full object-cover border-2 select-none pointer-events-none"
                      style={{ borderColor: token.color }}
                      alt={token.label}
                      draggable={false}
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-background border-2 border-background/30 select-none"
                      style={{ backgroundColor: token.color }}
                    >
                      {token.label.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {token.hp !== undefined && token.maxHp !== undefined && token.maxHp > 0 && (
                    <div className="w-9 h-1 bg-muted rounded-full mt-0.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(0, (token.hp / token.maxHp) * 100)}%`,
                          backgroundColor: token.hp / token.maxHp > 0.5
                            ? 'hsl(120, 60%, 40%)'
                            : token.hp / token.maxHp > 0.25
                              ? 'hsl(45, 93%, 47%)'
                              : 'hsl(0, 72%, 51%)',
                        }}
                      />
                    </div>
                  )}
                  <p className="text-[8px] font-mono text-foreground text-center mt-0.5 whitespace-nowrap pointer-events-none select-none">
                    {token.label}
                  </p>
                  {!isDM && token.ownerPlayerId === playerId && (
                    <p className="text-[8px] font-mono text-center text-secondary pointer-events-none select-none">
                      YOUR CHARACTER
                    </p>
                  )}
                  {isDM && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeToken(token.id); }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Token list bar */}
        {resolvedTokens.length > 0 && (
          <div className="bg-card border-t border-border p-2 flex gap-2 flex-wrap shrink-0">
            {resolvedTokens.map(t => (
              <div
                key={t.id}
                className={`flex items-center gap-1 text-[10px] font-mono cursor-pointer rounded px-1 py-0.5 transition-colors ${
                  t.id === selectedToken ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setSelectedToken(t.id)}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                {t.label}
                {showGrid && <span className="text-[8px] text-muted-foreground">[{getCellLabelFromPoint(t.x, t.y, { ...gridSettings, offsetX: gridOffset.x, offsetY: gridOffset.y })}]</span>}
                {t.hp !== undefined && <span className="text-[8px]">({t.hp}HP)</span>}
                {isDM && (
                  <button onClick={(e) => { e.stopPropagation(); removeToken(t.id); }} className="hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right sidebar: Initiative + Combat + Vision */}
      <div className="w-56 shrink-0 bg-card border-l border-border overflow-y-auto hidden md:flex flex-col gap-2 p-2">
        <InitiativeTracker
          tokens={resolvedTokens}
          currentTurnId={currentTurnId}
          entries={initiativeEntries}
          setEntries={setInitiativeEntries}
          onStartCombat={handleStartCombat}
          onNextTurn={handleNextTurn}
          onResetCombat={handleResetCombat}
          combatActive={combatActive}
          isDM={isDM}
          characters={characters}
        />

        {combatActive && currentTurnToken && canManageCurrentTurn && (
          <CombatPanel
            token={currentTurnToken}
            allTokens={resolvedTokens}
            gridSize={gridSize}
            ftPerCell={ftPerCell}
            onDamageToken={damageToken}
            onEndTurn={(nextState) => {
              setCombatTurnStates(current => ({
                ...current,
                [currentTurnToken.id]: nextState,
              }));
              setCombatMovementUsed(0);
              setCombatMoving(false);
              handleNextTurn();
            }}
            isCurrentTurn={true}
            movementUsed={combatMovementUsed}
            onSetMovementUsed={setCombatMovementUsed}
            onSetCombatMoving={setCombatMoving}
            combatMoving={combatMoving}
            characters={characters}
            turnState={combatTurnStates[currentTurnToken.id] ?? createCombatTurnState()}
            onTurnStateChange={(updater) => updateCombatTurnState(currentTurnToken.id, updater)}
          />
        )}

        {/* Vision radius controls (DM only, per selected character token) */}
        {isDM && currentToken && currentToken.type === 'character' && (
          <div className="border border-border rounded p-2">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
              Vision — {currentToken.label}
            </p>
            {showGrid && (
              <p className="text-[9px] font-mono text-muted-foreground mb-2">
                Cell {getCellLabelFromPoint(currentToken.x, currentToken.y, { ...gridSettings, offsetX: gridOffset.x, offsetY: gridOffset.y })}
              </p>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateTokenVision(currentToken.id, Math.max(1, ((currentToken.visionRadius ?? DEFAULT_VISION_CELLS * gridSize) / gridSize) - 2))}
                className="tactical-card !p-1 px-1"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono text-[10px] text-foreground flex-1 text-center">
                {Math.round((currentToken.visionRadius ?? DEFAULT_VISION_CELLS * gridSize) / gridSize * ftPerCell)}ft
              </span>
              <button
                onClick={() => updateTokenVision(currentToken.id, ((currentToken.visionRadius ?? DEFAULT_VISION_CELLS * gridSize) / gridSize) + 2)}
                className="tactical-card !p-1 px-1"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}


        {isDM && spellTemplates.length > 0 && (
          <div className="border border-border rounded p-2">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Spell Templates</p>
            <div className="space-y-1">
              {spellTemplates.map(template => (
                <div key={template.id} className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="truncate">{template.label}</span>
                  <button
                    onClick={() => dispatch({ type: 'map:spell_template_remove', spellTemplateId: template.id })}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Obstacle count */}
        {isDM && obstacles.length > 0 && (
          <div className="text-[9px] font-mono text-muted-foreground px-1">
            {obstacles.length} obstacle{obstacles.length !== 1 ? 's' : ''} · {obstacles.filter(o => o.blocksVision).length} vision · {obstacles.filter(o => o.blocksMovement).length} movement
          </div>
        )}
      </div>
    </div>
  );
}
