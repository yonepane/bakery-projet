import React from 'react';
import { useUISelector, useServerDataSelector, useMutationSelector } from '../DashboardContext';
import { useTranslation } from 'react-i18next';
import { ChefHat, Flame, MoveRight, CheckCircle2, ListTodo, Timer, Pause, Layers, Snowflake, Sticker, Package, Sparkles, User } from 'lucide-react';
import type { KitchenBatch } from '../hooks/useKitchenMutations';

const STAGES = [
  { id: 'planned',   label: 'Planned',   icon: ListTodo,     color: 'text-slate-400',  bg: 'bg-slate-400/10' },
  { id: 'prep',      label: 'Prep',      icon: ChefHat,     color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  { id: 'mix',       label: 'Mix',       icon: ChefHat,     color: 'text-cyan-500',    bg: 'bg-cyan-500/10' },
  { id: 'rest',      label: 'Rest',      icon: Pause,       color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { id: 'laminate',  label: 'Laminate',  icon: Layers,      color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10' },
  { id: 'proof',     label: 'Proof',     icon: Timer,       color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  { id: 'bake',      label: 'Bake',      icon: Flame,       color: 'text-rose-500',   bg: 'bg-rose-500/10' },
  { id: 'cool',      label: 'Cool',      icon: Snowflake,   color: 'text-sky-500',    bg: 'bg-sky-500/10' },
  { id: 'fill',      label: 'Fill',      icon: ChefHat,    color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'decorate',  label: 'Decorate',  icon: Sparkles,   color: 'text-pink-500',   bg: 'bg-pink-500/10' },
  { id: 'pack',      label: 'Pack',      icon: Package,    color: 'text-teal-500',   bg: 'bg-teal-500/10' },
  { id: 'display',   label: 'Display',   icon: Sticker,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'ready',     label: 'Ready',     icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
] as const;

export const KitchenBoardPanel: React.FC = () => {
  const { isDarkMode } = useUISelector();
  const { kitchenBatches: batches } = useServerDataSelector();
  const { handleAdvanceStage: onAdvanceStage, isKitchenUpdating: isUpdating } = useMutationSelector();
  const { t } = useTranslation();

  const getNextStage = (current: KitchenBatch['stage']): KitchenBatch['stage'] | null => {
    const idx = STAGES.findIndex(s => s.id === current);
    if (idx >= 0 && idx < STAGES.length - 1) {
      return STAGES[idx + 1].id as KitchenBatch['stage'];
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className={isDarkMode ? 'text-gold' : 'text-slate-900'} />
            Kitchen Board
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
            Track production batches through workflow stages
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 h-full min-w-max">
          {STAGES.map((stage) => {
            const stageBatches = batches.filter(b => b.stage === stage.id);
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`flex flex-col w-[280px] rounded-xl shrink-0 border ${
                  isDarkMode ? 'bg-[#1a1a1c] border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {/* Column Header */}
                <div className={`p-4 border-b flex items-center justify-between ${
                  isDarkMode ? 'border-white/5' : 'border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${stage.bg} ${stage.color}`}>
                      <Icon size={16} />
                    </div>
                    <span className="font-bold text-sm tracking-wide">{stage.label}</span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isDarkMode ? 'bg-white/10 text-white/50' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {stageBatches.length}
                  </span>
                </div>

                {/* Column Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {stageBatches.map(batch => {
                    const nextStage = getNextStage(batch.stage);
                    const isPreppingNext = batch.stage === 'planned';
                    
                    return (
                      <div
                        key={batch.id}
                        className={`p-4 rounded-xl border shadow-sm flex flex-col gap-3 transition-colors ${
                          isDarkMode 
                            ? 'bg-[#222225] border-white/5 hover:border-white/10' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm leading-tight">{batch.product_name}</span>
                            <span className="text-xs font-mono font-bold whitespace-nowrap ml-2">
                              {batch.quantity}x
                            </span>
                          </div>
                          <span className={`text-[10px] uppercase tracking-widest font-bold ${
                            isDarkMode ? 'text-white/40' : 'text-slate-400'
                          }`}>
                            For {batch.planned_for_date}
                          </span>
                        </div>

                        {nextStage && (
                          <button
                            disabled={isUpdating}
                            onClick={() => onAdvanceStage(batch.id, nextStage)}
                            className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                              isPreppingNext
                                ? (isDarkMode ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')
                                : (isDarkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
                            }`}
                          >
                            {isPreppingNext ? 'Start Prep' : `Move to ${STAGES.find(s => s.id === nextStage)?.label}`}
                            <MoveRight size={14} />
                          </button>
                        )}
                        
                        {batch.stage === 'ready' && (
                          <div className={`text-center text-[10px] font-bold uppercase tracking-widest ${stage.color}`}>
                            In Stock
                          </div>
                        )}

                        {/* Pastry-stage expansion: assignment, timer, and batch notes */}
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                          {batch.timer_minutes != null && (
                            <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'
                            }`}>
                              <Timer size={10} /> {batch.timer_minutes}min
                            </span>
                          )}
                          {batch.assigned_to_id != null && (
                            <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isDarkMode ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-50 text-sky-700'
                            }`}>
                              <User size={10} /> #{batch.assigned_to_id}
                            </span>
                          )}
                        </div>
                        {batch.batch_notes && (
                          <p className={`text-[11px] italic ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                            “{batch.batch_notes}”
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KitchenBoardPanel;
