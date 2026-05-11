'use client';
import React, { useState } from 'react';
import { Waves, Trash2, Eye, EyeOff, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { toStyleUa } from '@/lib/swim-style';

interface ExtractedEvent {
  distance: number;
  style: string;
  gender: 'M' | 'F';
}

interface EventConstructorProps {
  events: ExtractedEvent[];
  onConfirm: (selectedEvents: ExtractedEvent[]) => void;
  onBack: () => void;
}

export const EventConstructor: React.FC<EventConstructorProps> = ({ events, onConfirm, onBack }) => {
  const [disabledMap, setDisabledMap] = useState<Record<string, boolean>>({});

  const getEventKey = (e: ExtractedEvent) => `${e.distance}-${e.style}-${e.gender}`;

  const toggleEvent = (key: string) => {
    setDisabledMap(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCount = events.filter(e => !disabledMap[getEventKey(e)]).length;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="glass-card p-6 border-violet-500/20 bg-violet-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center text-violet-400 border border-violet-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Конструктор дистанцій</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                 Знайдено {events.length} унікальних забігів. Оберіть ті, що будуть створені.
              </p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Вибрано</div>
             <div className="text-2xl font-black text-violet-400">{selectedCount} / {events.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => {
          const key = getEventKey(event);
          const isDisabled = disabledMap[key];

          return (
            <div
              key={key}
              onClick={() => toggleEvent(key)}
              className={`glass-card p-5 border transition-all cursor-pointer group hover:scale-[1.02] ${
                isDisabled
                  ? 'bg-white/5 border-white/5 opacity-50'
                  : 'bg-white/[0.03] border-white/10 hover:border-violet-500/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                    isDisabled ? 'bg-white/5 border-white/10 text-slate-600' : 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                  }`}>
                    <Waves className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-lg font-black text-white">
                      {event.distance}м {toStyleUa(event.style)}
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${
                        event.gender === 'F' ? 'text-pink-500' : 'text-blue-500'
                    }`}>
                      {event.gender === 'F' ? '♀ Жінки' : '♂ Чоловіки'}
                    </div>
                  </div>
                </div>
                <button
                  className={`mt-1 p-2 rounded-lg transition-colors ${
                    isDisabled ? 'text-slate-600' : 'text-slate-400 group-hover:text-violet-400'
                  }`}
                >
                  {isDisabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="py-24 text-center glass-card border-dashed">
             <AlertCircle className="w-12 h-12 text-slate-700 mx-auto mb-4" />
             <p className="text-slate-500 font-bold uppercase tracking-widest">Дистанцій не знайдено</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-8 border-t border-white/5">
        <button onClick={onBack} className="btn-secondary">
          Назад до учасників
        </button>
        <button
          onClick={() => onConfirm(events.filter(e => !disabledMap[getEventKey(e)]))}
          disabled={selectedCount === 0}
          className="btn-primary flex items-center gap-2 !px-8"
        >
          <CheckCircle2 className="w-4 h-4" /> Завершити налаштування
        </button>
      </div>
    </div>
  );
};
