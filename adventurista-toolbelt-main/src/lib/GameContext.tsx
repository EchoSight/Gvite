import { createContext, useContext, useState, ReactNode } from 'react';
import type { GameRole } from './gameRole';
import { getGameRole } from './repositories';
import { setRole as persistRole } from './campaignMutations';

interface GameContextValue {
  role: GameRole;
  setRole: (role: GameRole) => void;
  isDM: boolean;
}

const GameContext = createContext<GameContextValue>({
  role: 'player',
  setRole: () => {},
  isDM: false,
});

export function GameProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<GameRole>(() => getGameRole());

  const handleSetRole = (r: GameRole) => {
    setRole(r);
    persistRole(r);
  };

  return (
    <GameContext.Provider value={{ role, setRole: handleSetRole, isDM: role === 'dm' }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
