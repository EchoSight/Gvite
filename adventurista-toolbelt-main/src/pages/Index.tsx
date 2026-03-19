import { useState, useEffect } from 'react';
import { getCharacters } from '@/lib/store';
import { Character } from '@/lib/types';
import { CharacterCard } from '@/components/CharacterCard';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

export default function CharacterList() {
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => {
    setCharacters(getCharacters());
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-lg text-foreground">CHARACTER ROSTER</h1>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest">{characters.length} BUILD{characters.length !== 1 ? 'S' : ''} REGISTERED</p>
        </div>
        <Link to="/create">
          <motion.div
            className="tactical-card py-2 px-4 flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold cursor-pointer"
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-3 h-3" /> NEW BUILD
          </motion.div>
        </Link>
      </div>

      {characters.length === 0 ? (
        <div className="tactical-card text-center py-16">
          <p className="font-display text-muted-foreground text-sm tracking-widest mb-4">NO CHARACTERS FOUND.</p>
          <Link to="/create">
            <motion.span
              className="text-[11px] uppercase tracking-widest text-foreground border-b border-foreground/30 pb-0.5 hover:border-foreground transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              INITIATE FIRST BUILD →
            </motion.span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          {characters.map(char => (
            <CharacterCard key={char.id} character={char} />
          ))}
        </div>
      )}
    </div>
  );
}
