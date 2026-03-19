import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EQUIPMENT_CATALOG, EquipmentItem } from '@/lib/types';
import { X, Search, Plus } from 'lucide-react';

interface EquipmentDrawerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: EquipmentItem) => void;
  existingIds: string[];
}

export function EquipmentDrawer({ open, onClose, onAdd, existingIds }: EquipmentDrawerProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return EQUIPMENT_CATALOG.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || item.category === filter;
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

  const categories = ['all', 'weapon', 'armor', 'gear', 'consumable'];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[360px] bg-card border-l border-border z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="tactical-header">EQUIPMENT CATALOG</span>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
                <span className="sr-only">CLOSE</span>
              </button>
            </div>
            <div className="p-4 border-b border-border space-y-2">
              <div className="flex items-center gap-2 bg-muted rounded-sm px-3 py-2">
                <Search className="w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search equipment..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent text-sm font-mono text-foreground outline-none flex-1 placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex gap-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm transition-colors ${
                      filter === cat ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.map((item, i) => (
                <motion.button
                  key={item.name}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left hover:bg-muted/30 transition-colors"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const id = `eq-${Date.now()}-${i}`;
                    onAdd({ ...item, id, equipped: false });
                  }}
                >
                  <Plus className="w-3 h-3 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="text-sm font-mono text-foreground">{item.name}</span>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase">{item.category}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{item.weight} lb</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
