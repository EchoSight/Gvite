import type { Character } from '@/lib/types';
import {
  SPELL_CATALOG,
  clearConcentration,
  getSpellDefinition,
  isSpellcastingClass,
  markConcentrationSpell,
  resetSpellcastingForLongRest,
  resetSpellcastingForShortRest,
  spendSpellSlot,
  updatePreparedSpell,
} from '@/lib/spellcasting';

interface SpellcastingPanelProps {
  character: Character;
  editable: boolean;
  onChange: (character: Character) => void;
}

export function SpellcastingPanel({ character, editable, onChange }: SpellcastingPanelProps) {
  if (!character.spellcasting || !isSpellcastingClass(character.class)) {
    return (
      <section>
        <p className="tactical-header mb-2">SPELLCASTING</p>
        <div className="tactical-card">
          <p className="text-sm text-muted-foreground font-mono">This class has no spellcasting tracker configured.</p>
        </div>
      </section>
    );
  }

  const { spellcasting } = character;
  const spellEntries = spellcasting.spells
    .map(entry => ({ entry, spell: getSpellDefinition(entry.spellId) }))
    .filter((value): value is { entry: typeof spellcasting.spells[number]; spell: NonNullable<ReturnType<typeof getSpellDefinition>> } => Boolean(value.spell))
    .sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name));
  const concentrationOptions = spellEntries.filter(({ spell }) => spell.concentration);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="tactical-header">SPELLCASTING</p>
        <div className="text-[10px] text-muted-foreground font-mono">
          {spellcasting.spellcastingAbility} · DC {spellcasting.spellSaveDc ?? '--'} · ATK {spellcasting.spellAttackBonus !== undefined ? `${spellcasting.spellAttackBonus >= 0 ? '+' : ''}${spellcasting.spellAttackBonus}` : '--'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        <div className="lg:col-span-4 tactical-card space-y-3">
          <div>
            <p className="stat-label mb-2">CONCENTRATION</p>
            <p className="font-mono text-sm text-foreground">
              {spellcasting.concentrationSpellName ?? 'None'}
            </p>
            <div className="flex gap-2 mt-2">
              <select
                value={spellcasting.concentrationSpellId ?? ''}
                onChange={event => onChange(markConcentrationSpell(character, event.target.value || null))}
                disabled={!editable}
                className="flex-1 bg-transparent border border-border rounded-sm px-2 py-2 text-xs font-mono text-foreground disabled:opacity-50"
              >
                <option value="">No concentration</option>
                {concentrationOptions.map(({ spell }) => (
                  <option key={spell.id} value={spell.id} className="bg-card">
                    {spell.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onChange(clearConcentration(character))}
                disabled={!editable}
                className="tactical-card !p-2 text-[10px] uppercase tracking-widest disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          <div>
            <p className="stat-label mb-2">REST RESET</p>
            <div className="flex gap-2">
              <button
                onClick={() => onChange(resetSpellcastingForShortRest(character))}
                disabled={!editable}
                className="flex-1 text-center text-[10px] uppercase tracking-widest text-secondary border border-border rounded-sm py-2 disabled:opacity-40"
              >
                Short Rest
              </button>
              <button
                onClick={() => onChange(resetSpellcastingForLongRest(character))}
                disabled={!editable}
                className="flex-1 text-center text-[10px] uppercase tracking-widest text-tactical-gold border border-border rounded-sm py-2 disabled:opacity-40"
              >
                Long Rest
              </button>
            </div>
          </div>

          {spellcasting.pactSlots && (
            <div>
              <p className="stat-label mb-2">PACT SLOTS</p>
              <div className="rounded-sm border border-border p-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span>Lvl {spellcasting.pactSlots.level}</span>
                  <span>{Math.max(0, spellcasting.pactSlots.max - spellcasting.pactSlots.used)} / {spellcasting.pactSlots.max}</span>
                </div>
                <button
                  onClick={() => onChange(spendSpellSlot(character, spellcasting.pactSlots?.level ?? 1, true))}
                  disabled={!editable || spellcasting.pactSlots.used >= spellcasting.pactSlots.max}
                  className="mt-2 w-full text-center text-[10px] uppercase tracking-widest border border-border rounded-sm py-1.5 disabled:opacity-40"
                >
                  Spend Pact Slot
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 tactical-card space-y-3">
          <div>
            <p className="stat-label mb-2">SPELL SLOTS</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {spellcasting.slots.filter(slot => slot.max > 0).map(slot => (
                <div key={slot.level} className="rounded-sm border border-border p-2">
                  <div className="flex items-center justify-between text-xs font-mono text-foreground">
                    <span>Level {slot.level}</span>
                    <span>{Math.max(0, slot.max - slot.used)} / {slot.max}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Array.from({ length: slot.max }, (_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const nextUsed = index + 1;
                          onChange({
                            ...character,
                            spellcasting: {
                              ...spellcasting,
                              slots: spellcasting.slots.map(current => current.level === slot.level ? { ...current, used: nextUsed } : current),
                            },
                          });
                        }}
                        disabled={!editable}
                        className={`w-5 h-5 rounded-full border ${index < slot.used ? 'bg-secondary border-secondary' : 'border-border bg-muted/40'} disabled:opacity-50`}
                        title={`Use ${index + 1} level ${slot.level} slot${index > 0 ? 's' : ''}`}
                      />
                    ))}
                    {slot.used > 0 && (
                      <button
                        onClick={() => onChange({
                          ...character,
                          spellcasting: {
                            ...spellcasting,
                            slots: spellcasting.slots.map(current => current.level === slot.level ? { ...current, used: Math.max(0, current.used - 1) } : current),
                          },
                        })}
                        disabled={!editable}
                        className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground disabled:opacity-40"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="stat-label mb-2">KNOWN / PREPARED SPELLS</p>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {spellEntries.map(({ entry, spell }) => (
                <div key={spell.id} className="rounded-sm border border-border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm text-foreground">{spell.name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} · {spell.castingTime} · {spell.rangeText}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {spell.durationText}{spell.area ? ` · ${spell.area.shape} ${spell.area.sizeFt}ft` : ''}{spell.concentration ? ' · Concentration' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {spell.level > 0 && (
                        <button
                          onClick={() => onChange(spendSpellSlot(character, spell.level))}
                          disabled={!editable}
                          className="text-[10px] uppercase tracking-widest border border-border rounded-sm px-2 py-1 disabled:opacity-40"
                        >
                          Cast
                        </button>
                      )}
                      {SPELL_CATALOG.length > 0 && spell.concentration && (
                        <button
                          onClick={() => onChange(markConcentrationSpell(character, spell.id))}
                          disabled={!editable}
                          className="text-[10px] uppercase tracking-widest text-accent disabled:opacity-40"
                        >
                          Focus
                        </button>
                      )}
                    </div>
                  </div>
                  {spell.level > 0 && (
                    <label className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={entry.prepared}
                        onChange={event => onChange(updatePreparedSpell(character, spell.id, event.target.checked))}
                        disabled={!editable}
                      />
                      Prepared
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
