import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinLobbyInvite } from '@/lib/networkCampaignSync';
import { useMultiplayerSession } from '@/lib/MultiplayerSessionContext';

export default function JoinSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings, saveSettings } = useMultiplayerSession();
  const [hostUrl, setHostUrl] = useState(settings.hostUrl);
  const [code, setCode] = useState('');
  const [playerName, setPlayerName] = useState(settings.playerName || 'Player');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillCode = useMemo(() => searchParams.get('code')?.trim().toUpperCase() || '', [searchParams]);
  const prefillHostUrl = useMemo(() => searchParams.get('hostUrl')?.trim() || settings.hostUrl, [searchParams, settings.hostUrl]);

  useEffect(() => {
    setCode(prefillCode);
    setHostUrl(prefillHostUrl);
  }, [prefillCode, prefillHostUrl]);

  const handleJoin = async () => {
    if (!hostUrl.trim() || !code.trim()) {
      setError('Host URL and room code are required.');
      return;
    }

    try {
      setPending(true);
      setError(null);
      const joined = await joinLobbyInvite(hostUrl.trim(), code.trim().toUpperCase(), playerName.trim() || 'Player');
      saveSettings({
        mode: 'hosted',
        hostUrl: joined.hostUrl,
        campaignId: joined.campaignId,
        playerId: joined.sessionId,
        playerName: joined.playerName,
        linkedCharacterId: settings.linkedCharacterId,
      });
      navigate('/maps');
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Failed to join room.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-xl tactical-card space-y-4">
        <div>
          <h1 className="font-display text-lg">JOIN SESSION</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Enter a host URL + room code from your DM.
          </p>
        </div>

        <label className="space-y-1 block">
          <span className="stat-label block">HOST URL</span>
          <input
            value={hostUrl}
            onChange={event => setHostUrl(event.target.value)}
            placeholder="https://your-host.example"
            className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
          />
        </label>

        <label className="space-y-1 block">
          <span className="stat-label block">ROOM CODE</span>
          <input
            value={code}
            onChange={event => setCode(event.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={12}
            className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50 tracking-[0.2em]"
          />
        </label>

        <label className="space-y-1 block">
          <span className="stat-label block">PLAYER NAME</span>
          <input
            value={playerName}
            onChange={event => setPlayerName(event.target.value)}
            placeholder="Aria's Tablet"
            className="w-full bg-transparent font-mono text-sm text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
          />
        </label>

        <motion.button
          onClick={() => void handleJoin()}
          disabled={pending || !hostUrl.trim() || !code.trim()}
          className="w-full border border-border rounded-sm px-3 py-2 text-[11px] uppercase tracking-widest font-bold hover:bg-foreground hover:text-background transition-colors disabled:opacity-30"
          whileTap={{ scale: 0.98 }}
        >
          {pending ? 'Joining...' : 'Join Session'}
        </motion.button>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
