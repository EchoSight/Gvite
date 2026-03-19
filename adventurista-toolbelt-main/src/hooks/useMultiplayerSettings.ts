import { useEffect, useState } from 'react';
import {
  getMultiplayerSettings,
  saveMultiplayerSettings,
  subscribeToMultiplayerSettings,
  type MultiplayerSettings,
} from '@/lib/multiplayerSettings';

export function useMultiplayerSettings() {
  const [settings, setSettings] = useState<MultiplayerSettings>(() => getMultiplayerSettings());

  useEffect(() => subscribeToMultiplayerSettings(setSettings), []);

  return {
    settings,
    saveSettings: (nextSettings: MultiplayerSettings) => {
      const normalized = saveMultiplayerSettings(nextSettings);
      setSettings(normalized);
      return normalized;
    },
  };
}
