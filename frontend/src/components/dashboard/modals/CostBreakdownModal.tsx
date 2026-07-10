import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { api } from '../../../lib/api';
import { Product } from '../types';

interface CostLine {
  type: 'ingredient' | 'semi_finished';
  name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  line_cost: number;
}

interface HistoryEntry {
  changed_at: string | null;
  lines_count: number;
}

interface CostBreakdown {
  product_id: string;
  product_name: string;
  selling_price: number;
  total_cost: number;
  margin_pct: number | null;
  yield_qty: number;
  cost_per_unit: number;
  lines: CostLine[];
  history: HistoryEntry[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  isDarkMode: boolean;
  formatPrice: (v: number) => string;
}

export const CostBreakdownModal: React.FC<Props> = ({
  isOpen, onClose, product, isDarkMode, formatPrice,
}) => {
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      setLoading(true);
      setError(null);
      api.get(`/api/products/${product.id}/cost-breakdown`)
        .then(res => setData(res.data ?? res))
        .catch(() => setError('Failed to load cost breakdown.'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const margin = data?.margin_pct;
  const marginColor = margin === null || margin === undefined ? 'text-slate-400'
    : margin >= 60 ? 'text-emerald-500'
    : margin >= 30 ? 'text-amber-500'
    : 'text-rose-500';

  const MarginIcon = margin === null || margin === undefined ? Minus
    : margin >= 60 ? TrendingUp
    : margin >= 30 ? Minus
    : TrendingDown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-[#1a1a1c] text-white' : 'bg-white text-slate-900'}`}>
        {/* Header */}
        <div className={`p-6 border-b flex justify-between items-start shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <div>
            <h2 className="text-xl font-bold">Cost Breakdown</h2>
            <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>{product.name}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <p className={`text-sm text-center py-12 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              Calculating…
            </p>
          )}
          {error && (
            <p className="text-sm text-center py-12 text-rose-500">{error}</p>
          )}
          {data && !loading && (
            <>
              {/* Summary chips */}
              <div className="grid grid-cols-3 gap-4">
                <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Selling Price</p>
                  <p className="text-xl font-bold">{formatPrice(data.selling_price)}</p>
                </div>
                <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Cost / Unit</p>
                  <p className="text-xl font-bold text-rose-400">{formatPrice(data.cost_per_unit)}</p>
                </div>
                <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Margin</p>
                  <p className={`text-xl font-bold flex items-center gap-1 ${marginColor}`}>
                    <MarginIcon size={18} />
                    {margin !== null && margin !== undefined ? `${margin}%` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Per-line breakdown */}
              {data.lines.length === 0 ? (
                <p className={`text-sm text-center py-4 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                  No recipe defined for this product.
                </p>
              ) : (
                <div>
                  <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                    Recipe Lines (yield: {data.yield_qty} units)
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'border-white/10 text-white/30' : 'border-slate-100 text-slate-400'}`}>
                        <th className="pb-2 text-left">Ingredient</th>
                        <th className="pb-2 text-left">Type</th>
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">Unit Cost</th>
                        <th className="pb-2 text-right">Line Cost</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-50'}`}>
                      {data.lines.map((line, idx) => (
                        <tr key={idx} className="group">
                          <td className="py-3 font-semibold">{line.name}</td>
                          <td className="py-3">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                              line.type === 'semi_finished'
                                ? (isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700')
                                : (isDarkMode ? 'bg-white/5 text-white/40' : 'bg-slate-100 text-slate-500')
                            }`}>
                              {line.type === 'semi_finished' ? 'Semi' : 'Raw'}
                            </span>
                          </td>
                          <td className={`py-3 text-right font-mono ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>
                            {line.quantity} {line.unit}
                          </td>
                          <td className={`py-3 text-right font-mono ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>
                            {formatPrice(line.unit_cost)}
                          </td>
                          <td className="py-3 text-right font-bold">
                            {formatPrice(line.line_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className={`border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <td colSpan={4} className={`pt-3 font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                          Total batch cost
                        </td>
                        <td className="pt-3 text-right font-bold text-rose-400">
                          {formatPrice(data.total_cost * data.yield_qty)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Recipe history */}
              {data.history.length > 0 && (
                <div>
                  <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                    <Clock size={10} /> Recipe History
                  </h3>
                  <div className="space-y-1.5">
                    {data.history.map((h, idx) => (
                      <div key={idx} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${isDarkMode ? 'bg-white/5 text-white/60' : 'bg-slate-50 text-slate-600'}`}>
                        <span>{h.changed_at ? new Date(h.changed_at).toLocaleString() : 'Unknown time'}</span>
                        <span className={`text-[9px] font-bold ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>{h.lines_count} lines</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
