'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { GAME_MODES, getGameMode } from '@/lib/osrs';

interface Props {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
}

export default function GameModeSelect({ value, onChange, includeAll = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = value === 'all' ? null : getGameMode(value);
  const label = value === 'all' ? 'All modes' : (selected?.label ?? value);
  const icon = selected?.emoji || null;

  const options = includeAll
    ? [{ key: 'all', label: 'All modes', emoji: '' }, ...GAME_MODES]
    : GAME_MODES;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-[#1e1c2a] border border-white/[0.07] rounded-xl px-2 sm:px-3 py-2 text-slate-300 text-xs sm:text-sm focus:outline-none focus:border-emerald-500/50 min-w-0 sm:min-w-[150px] justify-between whitespace-nowrap"
      >
        <span className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          {icon && <Image src={icon} alt={label} width={14} height={14} className={`shrink-0 opacity-90 ${selected?.key === 'realism_group_ironman' ? 'h-4' : 'h-3.5'} w-auto`} />}
          <span className="truncate">{label}</span>
        </span>
        <svg className={`w-3 sm:w-3.5 h-3 sm:h-3.5 text-slate-500 transition-transform shrink-0 ml-1`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 right-0 sm:w-full min-w-[160px] sm:min-w-[200px] bg-[#1e1c2a] border border-white/[0.07] rounded-xl shadow-xl overflow-hidden">
          {options.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => { onChange(m.key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm transition-colors text-left hover:bg-white/[0.05] ${
                value === m.key ? 'text-emerald-400' : 'text-slate-300'
              }`}
            >
              {m.emoji
                ? <Image src={m.emoji} alt={m.label} width={14} height={14} className={`shrink-0 opacity-90 ${m.key === 'realism_group_ironman' ? 'h-4' : 'h-3.5'} w-auto`} />
                : <span className="w-[14px] shrink-0" />}
              <span className="truncate">{m.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
