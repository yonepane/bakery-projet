import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat, Flame, MoveRight, CheckCircle2, ListTodo, Timer } from 'lucide-react';
import { DashboardSharedProps } from '../types';
import type { KitchenBatch } from '../hooks/useKitchenMutations';

type Props = Pick<DashboardSharedProps, 'isDarkMode'> & {
  batches: KitchenBatch[];
  onAdvanceStage: (batchId: string, newStage: KitchenBatch['stage']) => void;
  isUpdating: boolean;
};

const STAGES = [
  { id: 'planned', label: 'Planned', icon: ListTodo, color: 'text-slate-400', bg: 'bg-slate-400/10' },
  { id: 'prepping', label: 'Prep & Mix', icon: ChefHat, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'proofing', label: 'Proofing', icon: Timer, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'baking', label: 'Baking', icon: Flame, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { id: 'ready', label: 'Ready', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
] as const;

export const KitchenBoardPanel: React.FC<Props> = ({ isDarkMode, batches, onAdvanceStage, isUpdating }) => {
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
