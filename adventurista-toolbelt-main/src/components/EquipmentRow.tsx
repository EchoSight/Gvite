import { motion } from 'framer-motion';
import { EquipmentItem } from '@/lib/types';
import { X, Check } from 'lucide-react';

interface EquipmentRowProps {
  item: EquipmentItem;
  onToggleEquip?: (id: string) => void;
  onRemove?: (id: string) => void;
  editable?: boolean;
}

export function EquipmentRow({ item, onToggleEquip, onRemove, editable }: EquipmentRowProps) {
  return (
    <motion.div
      className="flex items-center gap-4 px-4 py-2 border-b border-border text-sm font-mono hover:bg-muted/30 transition-colors duration-150"
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
    >
      <span className="text-muted-foreground w-8 text-right tabular-nums">{item.quantity}×</span>
      <span className="flex-1 text-foreground">
        {item.name}
        {item.damageDie && item.category === 'weapon' && (
          <span className="ml-1 text-[9px] text-muted-foreground">
            (1d{item.damageDie}{(item.damageBonus || 0) > 0 ? `+${item.damageBonus}` : ''})
          </span>
        )}
        {item.acBonus && item.category === 'armor' && (
          <span className="ml-1 text-[9px] text-muted-foreground">(+{item.acBonus} AC)</span>
        )}
      </span>
      <span className="text-muted-foreground w-16 text-right tabular-nums">{item.weight} lb</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20">{item.category}</span>
      {editable && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleEquip?.(item.id)}
            className={`p-1 rounded-sm transition-colors ${item.equipped ? 'text-tactical-blue' : 'text-muted-foreground hover:text-foreground'}`}
            title={item.equipped ? 'UNEQUIP' : 'EQUIP'}
          >
            <Check className="w-3 h-3" />
            <span className="sr-only">{item.equipped ? 'UNEQUIP' : 'EQUIP'}</span>
          </button>
          <button
            onClick={() => onRemove?.(item.id)}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            title="DROP"
          >
            <X className="w-3 h-3" />
            <span className="sr-only">DROP</span>
          </button>
        </div>
      )}
      {!editable && item.equipped && (
        <span className="text-[10px] uppercase tracking-wider text-tactical-blue">EQUIPPED</span>
      )}
    </motion.div>
  );
}
