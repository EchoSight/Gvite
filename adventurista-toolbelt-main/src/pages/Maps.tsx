import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapCanvas } from '@/components/MapCanvas';
import type { MapEntry } from '@/lib/repositories';
import { useMapCollectionSession } from '@/hooks/useMapSessions';
import { useMultiplayerSession } from '@/lib/MultiplayerSessionContext';
import { useCharacterCollectionSession } from '@/hooks/useCharacterSessions';
import { Plus, X, Upload, Maximize2, ArrowLeft, Plug, Server } from 'lucide-react';

export default function Maps() {
  const { snapshot, createMap, removeMap, status } = useMapCollectionSession();
  const { settings, saveSettings } = useMultiplayerSession();
  const { snapshot: characterSnapshot } = useCharacterCollectionSession();
  const { maps } = snapshot;
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mapName, setMapName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [hostUrl, setHostUrl] = useState(settings.hostUrl);
  const [campaignId, setCampaignId] = useState(settings.campaignId);
  const [mode, setMode] = useState(settings.mode);
  const [mapActionPending, setMapActionPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHostUrl(settings.hostUrl);
    setCampaignId(settings.campaignId);
    setMode(settings.mode);
  }, [settings]);

  const activeMap = maps.find(m => m.id === activeMapId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Max file size is 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      if (!mapName) setMapName(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview || !mapName.trim()) return;
    const entry: MapEntry = {
      id: `map-${Date.now()}`,
      name: mapName.trim(),
      image: preview,
      createdAt: new Date().toISOString(),
    };

    try {
      setMapActionPending(true);
      await createMap(entry);
      setUploading(false);
      setMapName('');
      setPreview(null);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to upload map.');
    } finally {
      setMapActionPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setMapActionPending(true);
      await removeMap(id);
      if (activeMapId === id) setActiveMapId(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete map.');
    } finally {
      setMapActionPending(false);
    }
  };

  const handleSaveConnection = () => {
    saveSettings({
      mode,
      hostUrl,
      campaignId,
    });
  };

  if (activeMap) {
    return (
      <div className="flex-1 flex flex-col h-screen md:h-auto overflow-hidden">
        <div className="flex items-center gap-3 p-3 bg-card border-b border-border shrink-0">
          <button onClick={() => setActiveMapId(null)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="font-display text-sm text-foreground truncate">{activeMap.name}</h2>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {status.mode === 'hosted' ? `HOSTED SESSION · ${status.state}` : 'LOCAL SESSION'}
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <MapCanvas mapImage={activeMap.image} mapId={activeMap.id} characters={characterSnapshot.characters} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-lg text-foreground">CAMPAIGN MAPS</h1>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest">
            {maps.length} MAP{maps.length !== 1 ? 'S' : ''} UPLOADED
          </p>
        </div>
        <motion.button
          onClick={() => setUploading(!uploading)}
          className="tactical-card py-2 px-4 flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold"
          whileTap={{ scale: 0.98 }}
        >
          {uploading ? <><X className="w-3 h-3" /> CANCEL</> : <><Plus className="w-3 h-3" /> UPLOAD MAP</>}
        </motion.button>
      </div>

      <div className="tactical-card mb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-sm text-foreground">MULTIPLAYER HOST CONNECTION</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {status.mode === 'hosted' ? `HOSTED · ${status.state}` : 'LOCAL-ONLY MODE'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            {status.mode === 'hosted' ? <Server className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
            {status.error ? 'Error' : status.state}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="stat-label block">MODE</span>
            <select
              value={mode}
              onChange={e => setMode(e.target.value === 'hosted' ? 'hosted' : 'local')}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1"
            >
              <option value="local">Local</option>
              <option value="hosted">Hosted</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="stat-label block">HOST URL</span>
            <input
              value={hostUrl}
              onChange={e => setHostUrl(e.target.value)}
              placeholder="http://127.0.0.1:8787"
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
            />
          </label>
          <label className="space-y-1">
            <span className="stat-label block">CAMPAIGN ID</span>
            <input
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
              placeholder="campaign-dev"
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Use Hosted mode to fetch maps from the DM host, upload map assets to the server, and stream live map updates over WebSocket.
          </p>
          <motion.button
            onClick={handleSaveConnection}
            className="border border-border rounded-sm px-3 py-2 text-[11px] uppercase tracking-widest font-bold hover:bg-foreground hover:text-background transition-colors"
            whileTap={{ scale: 0.98 }}
          >
            SAVE CONNECTION
          </motion.button>
        </div>

        {status.error && (
          <p className="text-xs text-destructive">{status.error}</p>
        )}
      </div>

      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="tactical-card space-y-3">
              <div>
                <label className="stat-label block mb-1">MAP NAME</label>
                <input
                  value={mapName}
                  onChange={e => setMapName(e.target.value)}
                  placeholder="Dungeon Level 1..."
                  className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="stat-label block mb-1">IMAGE (Max 5MB)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <motion.button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border border-dashed border-border rounded-sm py-6 text-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-[11px] uppercase tracking-widest font-bold">
                    {preview ? 'FILE SELECTED' : 'CLICK TO SELECT IMAGE'}
                  </span>
                </motion.button>
                {preview && (
                  <img src={preview} alt="Preview" className="mt-2 max-h-32 rounded-sm border border-border" />
                )}
              </div>
              <motion.button
                onClick={() => void handleUpload()}
                disabled={!preview || !mapName.trim() || mapActionPending}
                className="w-full text-center text-[11px] uppercase tracking-widest font-bold border border-border rounded-sm py-2 hover:bg-foreground hover:text-background transition-colors disabled:opacity-30"
                whileTap={{ scale: 0.98 }}
              >
                {status.mode === 'hosted' ? 'UPLOAD MAP TO HOST' : 'UPLOAD MAP'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {maps.length === 0 ? (
        <div className="tactical-card text-center py-16">
          <p className="font-display text-muted-foreground text-sm tracking-widest mb-4">NO MAPS UPLOADED.</p>
          <button
            onClick={() => setUploading(true)}
            className="text-[11px] uppercase tracking-widest text-foreground border-b border-foreground/30 pb-0.5 hover:border-foreground transition-colors"
          >
            UPLOAD YOUR FIRST MAP →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {maps.map(map => (
            <motion.div
              key={map.id}
              className="tactical-card p-0 overflow-hidden cursor-pointer group"
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative" onClick={() => setActiveMapId(map.id)}>
                <img src={map.image} alt={map.name} className="w-full h-40 object-cover" />
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-6 h-6 text-foreground" />
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm text-foreground">{map.name}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(map.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); void handleDelete(map.id); }}
                  disabled={mapActionPending}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
