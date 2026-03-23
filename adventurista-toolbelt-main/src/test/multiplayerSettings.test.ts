import { describe, expect, it } from 'vitest';
import { getDefaultMultiplayerSettings, getMultiplayerSettingsFromUrl } from '@/lib/multiplayerSettings';

describe('multiplayerSettings URL parsing', () => {
  it('hydrates hosted session settings from a share link', () => {
    expect(
      getMultiplayerSettingsFromUrl('?hostUrl=http%3A%2F%2F192.168.1.42%3A8787&campaignId=table-night&playerName=Dungeon%20Master&mode=hosted'),
    ).toEqual({
      mode: 'hosted',
      hostUrl: 'http://192.168.1.42:8787',
      campaignId: 'table-night',
      playerName: 'Dungeon Master',
    });
  });

  it('assumes hosted mode when a host URL or campaign id is supplied', () => {
    expect(
      getMultiplayerSettingsFromUrl('?hostUrl=http%3A%2F%2F10.0.0.5%3A8787&campaignId=camp-dev'),
    ).toEqual({
      mode: 'hosted',
      hostUrl: 'http://10.0.0.5:8787',
      campaignId: 'camp-dev',
    });
  });

  it('leaves defaults unchanged when no multiplayer query params are present', () => {
    expect({
      ...getDefaultMultiplayerSettings(),
      ...getMultiplayerSettingsFromUrl(''),
    }).toEqual(getDefaultMultiplayerSettings());
  });
});
