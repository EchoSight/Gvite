export type MultiplayerMode = 'local' | 'hosted';

export interface MultiplayerSettings {
  mode: MultiplayerMode;
  hostUrl: string;
  campaignId: string;
  playerId: string;
  playerName: string;
  linkedCharacterId: string;
}

const STORAGE_KEY = 'adventurista-multiplayer-settings';
const CHANGE_EVENT = 'adventurista:multiplayer-settings-changed';

const defaultSettings: MultiplayerSettings = {
  mode: 'local',
  hostUrl: 'http://127.0.0.1:8787',
  campaignId: 'campaign-dev',
  playerId: '',
  playerName: 'Player',
  linkedCharacterId: '',
};

export function getDefaultMultiplayerSettings(): MultiplayerSettings {
  return { ...defaultSettings };
}

function normalizeMultiplayerSettings(settings: Partial<MultiplayerSettings>): MultiplayerSettings {
  return {
    mode: settings.mode === 'hosted' ? 'hosted' : 'local',
    hostUrl: settings.hostUrl?.trim() || defaultSettings.hostUrl,
    campaignId: settings.campaignId?.trim() || defaultSettings.campaignId,
    playerId: settings.playerId?.trim() || defaultSettings.playerId,
    playerName: settings.playerName?.trim() || defaultSettings.playerName,
    linkedCharacterId: settings.linkedCharacterId?.trim() || defaultSettings.linkedCharacterId,
  };
}

export function getMultiplayerSettingsFromUrl(search: string): Partial<MultiplayerSettings> {
  const normalizedSearch = search.startsWith('?') ? search : `?${search}`;
  const params = new URLSearchParams(normalizedSearch);
  const hostUrl = params.get('hostUrl')?.trim() || '';
  const campaignId = params.get('campaignId')?.trim() || '';
  const modeParam = params.get('mode')?.trim().toLowerCase();

  const overrides: Partial<MultiplayerSettings> = {};

  if (modeParam === 'hosted' || modeParam === 'local') {
    overrides.mode = modeParam;
  } else if (hostUrl || campaignId) {
    overrides.mode = 'hosted';
  }

  if (hostUrl) overrides.hostUrl = hostUrl;
  if (campaignId) overrides.campaignId = campaignId;

  const playerId = params.get('playerId')?.trim();
  const playerName = params.get('playerName')?.trim();
  const linkedCharacterId = params.get('linkedCharacterId')?.trim();

  if (playerId) overrides.playerId = playerId;
  if (playerName) overrides.playerName = playerName;
  if (linkedCharacterId) overrides.linkedCharacterId = linkedCharacterId;

  return overrides;
}

export function getMultiplayerSettings(): MultiplayerSettings {
  if (typeof window === 'undefined') return getDefaultMultiplayerSettings();

  const stored = window.localStorage.getItem(STORAGE_KEY);
  const runtimeOverrides = getMultiplayerSettingsFromUrl(window.location.search);

  if (!stored) {
    return normalizeMultiplayerSettings({
      ...getDefaultMultiplayerSettings(),
      ...runtimeOverrides,
    });
  }

  try {
    const parsed = JSON.parse(stored) as Partial<MultiplayerSettings>;
    return normalizeMultiplayerSettings({
      ...parsed,
      ...runtimeOverrides,
    });
  } catch {
    return normalizeMultiplayerSettings({
      ...getDefaultMultiplayerSettings(),
      ...runtimeOverrides,
    });
  }
}

export function saveMultiplayerSettings(settings: MultiplayerSettings): MultiplayerSettings {
  const normalized = normalizeMultiplayerSettings(settings);

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
