import { createContext, useContext, useState, ReactNode } from 'react';

export type GameRole = 'dm' | 'player';

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
  const [role, setRole] = useState<GameRole>(() => {
    return (localStorage.getItem('dnd_role') as GameRole) || 'player';
  });

  const handleSetRole = (r: GameRole) => {
    setRole(r);
    localStorage.setItem('dnd_role', r);
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
