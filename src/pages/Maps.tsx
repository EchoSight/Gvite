import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapCanvas } from '@/components/MapCanvas';
import { Plus, X, Upload, Maximize2, ArrowLeft } from 'lucide-react';

interface MapEntry {
  id: string;
  name: string;
  image: string; // base64
  createdAt: string;
}

const MAPS_KEY = 'dnd_maps';

function getMaps(): MapEntry[] {
  const data = localStorage.getItem(MAPS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveMaps(maps: MapEntry[]) {
  localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
}

export default function Maps() {
  const [maps, setMaps] = useState<MapEntry[]>(getMaps());
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mapName, setMapName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = () => {
    if (!preview || !mapName.trim()) return;
    const entry: MapEntry = {
      id: `map-${Date.now()}`,
      name: mapName.trim(),
      image: preview,
      createdAt: new Date().toISOString(),
    };
    const updated = [...maps, entry];
    saveMaps(updated);
    setMaps(updated);
    setUploading(false);
    setMapName('');
    setPreview(null);
  };

  const handleDelete = (id: string) => {
    const updated = maps.filter(m => m.id !== id);
    saveMaps(updated);
    setMaps(updated);
    localStorage.removeItem(`map-tokens-${id}`);
    if (activeMapId === id) setActiveMapId(null);
  };

  // Active map view (full canvas)
  if (activeMap) {
    return (
      <div className="flex-1 flex flex-col h-screen md:h-auto overflow-hidden">
        <div className="flex items-center gap-3 p-3 bg-card border-b border-border shrink-0">
          <button onClick={() => setActiveMapId(null)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-display text-sm text-foreground truncate">{activeMap.name}</h2>
        </div>
        <div className="flex-1 min-h-0">
          <MapCanvas mapImage={activeMap.image} mapId={activeMap.id} />
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

      {/* Upload form */}
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
                onClick={handleUpload}
                disabled={!preview || !mapName.trim()}
                className="w-full text-center text-[11px] uppercase tracking-widest font-bold border border-border rounded-sm py-2 hover:bg-foreground hover:text-background transition-colors disabled:opacity-30"
                whileTap={{ scale: 0.98 }}
              >
                UPLOAD MAP
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map grid */}
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
                  onClick={(e) => { e.stopPropagation(); handleDelete(map.id); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
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
