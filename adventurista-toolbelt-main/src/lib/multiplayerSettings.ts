export type MultiplayerMode = 'local' | 'hosted';

export interface MultiplayerSettings {
  mode: MultiplayerMode;
  hostUrl: string;
  campaignId: string;
}

const STORAGE_KEY = 'adventurista-multiplayer-settings';
const CHANGE_EVENT = 'adventurista:multiplayer-settings-changed';

const defaultSettings: MultiplayerSettings = {
  mode: 'local',
  hostUrl: 'http://127.0.0.1:8787',
  campaignId: 'campaign-dev',
};

export function getDefaultMultiplayerSettings(): MultiplayerSettings {
  return { ...defaultSettings };
}

export function getMultiplayerSettings(): MultiplayerSettings {
  if (typeof window === 'undefined') return getDefaultMultiplayerSettings();

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return getDefaultMultiplayerSettings();

  try {
    const parsed = JSON.parse(stored) as Partial<MultiplayerSettings>;
    return {
      mode: parsed.mode === 'hosted' ? 'hosted' : 'local',
      hostUrl: parsed.hostUrl?.trim() || defaultSettings.hostUrl,
      campaignId: parsed.campaignId?.trim() || defaultSettings.campaignId,
    };
  } catch {
    return getDefaultMultiplayerSettings();
  }
}

export function saveMultiplayerSettings(settings: MultiplayerSettings): MultiplayerSettings {
  const normalized: MultiplayerSettings = {
    mode: settings.mode === 'hosted' ? 'hosted' : 'local',
    hostUrl: settings.hostUrl.trim() || defaultSettings.hostUrl,
    campaignId: settings.campaignId.trim() || defaultSettings.campaignId,
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent<MultiplayerSettings>(CHANGE_EVENT, { detail: normalized }));
  }

  return normalized;
}

export function subscribeToMultiplayerSettings(listener: (settings: MultiplayerSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== STORAGE_KEY) return;
    listener(getMultiplayerSettings());
  };

  const handleChange = (event: Event) => {
    const customEvent = event as CustomEvent<MultiplayerSettings>;
    listener(customEvent.detail ?? getMultiplayerSettings());
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(CHANGE_EVENT, handleChange as EventListener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CHANGE_EVENT, handleChange as EventListener);
  };
}

export function isHostedMultiplayerEnabled(settings: MultiplayerSettings): boolean {
  return settings.mode === 'hosted' && Boolean(settings.hostUrl.trim()) && Boolean(settings.campaignId.trim());
}
