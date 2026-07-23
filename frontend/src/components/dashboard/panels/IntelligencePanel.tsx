import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import { useUISelector, useServerDataSelector } from '../DashboardContext';
import type { Product } from '../types';
import { Brain, TrendingUp, TrendingDown, Zap, Trophy, Star, Sparkles, ArrowUpRight, Activity, Coins, ShieldAlert, Layers, Percent, Target, ArrowRight, ArrowDownRight } from 'lucide-react';
import { calculateMarginPercent, calculateMarkupPercent } from '../../../domains/pricing/margins';
import { Table, TableHeader, TableBody, TableRow, Th, Td } from '../../ui/Table';

const IntelligencePanel: React.FC = () => {
  const { isDarkMode, formatPrice } = useUISelector();
  const { profitReport, inventory, analytics } = useServerDataSelector();
  const { t } = useTranslation();

  const cardRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty('--mouse-x', `-999px`);
    cardRef.current.style.setProperty('--mouse-y', `-999px`);
  };

  // Normalize the profit report — backend may return product_name/cost_price/selling_price
  // or name/unit_cost/sell_price depending on cache state. Support both shapes.
  const normalizedReport = (profitReport.length > 0 ? profitReport : inventory.products.map((p: Product) => ({
    product_name: p.name,
    name: p.name,
    icon: p.icon,
    selling_price: p.price,
    sell_price: p.price,
    cost_price: p.live_cost || 0,
    unit_cost: p.live_cost || 0,
    margin_percentage: p.price > 0 ? `${calculateMarginPercent(p.price, p.live_cost || 0).toFixed(1)}%` : '0%',
  }))).map((p: any) => ({
    name: p.product_name || p.name || 'Unknown',
    icon: p.icon || '🥐',
    sellPrice: p.selling_price ?? p.sell_price ?? 0,
    unitCost: p.cost_price ?? p.unit_cost ?? 0,
    margin: parseFloat((p.margin_percentage || p.margin || '0').toString().replace('%', '')),
    roi: p.roi_percentage ? parseFloat(p.roi_percentage.replace('%', '')) : 0,
  }));

  const topProduct = [...normalizedReport].sort((a, b) => b.margin - a.margin)[0];
  const atRisk = normalizedReport.filter((p: { margin: number }) => p.margin < 25);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-gold/10 text-gold shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
          <Brain size={26} />
        </div>
        <div>
          <h3 className={`text-3xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('intelligence_matrix')}</h3>
          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{t('live_portfolio_analysis')}</p>
        </div>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { 
            label: 'Inventory Cost', 
            value: formatPrice(analytics.intelligence.total_portfolio_cost), 
            color: 'text-rose-400',
            glowColor: 'hover:border-rose-500/30 hover:shadow-[0_0_30px_rgba(244,63,94,0.08)]',
            icon: <Coins size={14} className="text-rose-400" />,
            visual: (
              <div className="flex gap-1 items-end h-5 mt-2 opacity-50">
                <div className="w-1 h-2 bg-rose-400/40 rounded-sm" />
                <div className="w-1 h-3 bg-rose-400/60 rounded-sm animate-[pulse_1s_infinite_100ms]" />
                <div className="w-1 h-4.5 bg-rose-400 rounded-sm animate-[pulse_1s_infinite_200ms]" />
              </div>
            )
          },
          { 
            label: 'Average Margin', 
            value: analytics.intelligence.average_margin, 
            color: 'text-emerald-400',
            glowColor: 'hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]',
            icon: <Percent size={14} className="text-emerald-400" />,
            visual: (() => {
              const numVal = parseFloat(analytics.intelligence.average_margin.replace('%', '')) || 0;
              const radius = 8;
              const strokeWidth = 2;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (numVal / 100) * circumference;
              return (
                <svg className="w-8 h-8 -rotate-90 mt-1" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r={radius} stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth={strokeWidth} fill="transparent" />
                  <circle cx="12" cy="12" r={radius} stroke="#10b981" strokeWidth={strokeWidth} fill="transparent" 
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
              );
            })()
          },
          { 
            label: 'Active SKUs', 
            value: String(analytics.intelligence.products_count || normalizedReport.length), 
            color: isDarkMode ? 'text-gold' : 'text-slate-900',
            glowColor: 'hover:border-gold/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.08)]',
            icon: <Layers size={14} className="text-gold" />,
            visual: (
              <div className="grid grid-cols-3 gap-1 w-6 h-6 items-center mt-2 opacity-60">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-gold/60' : 'bg-slate-700/60'} animate-pulse`} style={{ animationDelay: `${idx * 150}ms` }} />
                ))}
              </div>
            )
          },
          { 
            label: 'At-Risk Products', 
            value: String(atRisk.length), 
            color: atRisk.length > 0 ? 'text-rose-400' : 'text-emerald-400',
            glowColor: atRisk.length > 0 ? 'hover:border-rose-500/30 hover:shadow-[0_0_30px_rgba(244,63,94,0.08)]' : 'hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]',
            icon: <ShieldAlert size={14} className={atRisk.length > 0 ? 'text-rose-400' : 'text-emerald-400'} />,
            visual: (
              <div className="relative w-8 h-8 flex items-center justify-center mt-1">
                {atRisk.length > 0 ? (
                  <>
                    <div className="absolute w-5 h-5 rounded-full bg-rose-500/20 animate-ping" />
                    <div className="absolute w-3.5 h-3.5 rounded-full bg-rose-500/40 animate-pulse" />
                    <ShieldAlert size={14} className="text-rose-400 relative z-10" />
                  </>
                ) : (
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-[8px] animate-pulse">✓</div>
                )}
              </div>
            )
          },
        ].map((kpi, i) => (
          <div 
            key={i} 
            className={`group p-6 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between ${
              isDarkMode 
                ? `bg-gradient-to-b from-slate-900/60 to-black/60 border-white/5 shadow-glass ${kpi.glowColor} hover:-translate-y-0.5` 
                : `bg-white border-slate-200 shadow-xl hover:border-slate-300 hover:-translate-y-0.5 ${kpi.glowColor}`
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'text-cream/35' : 'text-slate-400'}`}>{kpi.label}</p>
                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                  {kpi.icon}
                </div>
              </div>
              <p className={`text-3xl font-black luxury-font tracking-tight ${kpi.color}`}>{kpi.value}</p>
            </div>
            
            {/* Embedded Micro-Telemetry Graphic */}
            <div className="flex justify-end items-center mt-4">
              {kpi.visual}
            </div>
          </div>
        ))}
      </div>

      {/* Star product callout */}
      {topProduct && (() => {
        const computedRoi = calculateMarkupPercent(topProduct.sellPrice, topProduct.unitCost);
        const totalSegments = 16;
        const filledSegments = Math.round((topProduct.margin / 100) * totalSegments);

        return (
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden rounded-[2rem] border transition-all duration-500 group hover:-translate-y-0.5 hover:shadow-2xl ${
              isDarkMode
                ? 'border-white/10 hover:border-gold/40 bg-gradient-to-b from-slate-900/90 to-black/90 shadow-[0_0_50px_rgba(212,175,55,0.05)]'
                : 'bg-gradient-to-b from-[#fdfdfd] to-[#faf8f4] border-[#e3dfd5] hover:border-[#d4af37]/50 shadow-[0_15px_40px_rgba(180,130,20,0.04)] shadow-[#f59e0b]/5'
            }`}
          >
            {/* Interactive Spotlight Effect */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
              style={{
                background: isDarkMode
                  ? 'radial-gradient(400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(212, 175, 55, 0.08), transparent 60%)'
                  : 'radial-gradient(400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(212, 175, 55, 0.04), transparent 60%)',
              }}
            />

            {/* Interactive Backdrop Shimmer & Gradients */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-gold/10 blur-[80px] pointer-events-none group-hover:bg-gold/15 transition-all duration-1000" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-1000" />

            <div className="relative p-6 flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
              
              {/* Left: Product Info Identity */}
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className={`relative shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-700 group-hover:scale-[1.03] group-hover:rotate-2 ${
                  isDarkMode 
                    ? 'bg-slate-900/60 border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] group-hover:border-gold/30' 
                    : 'bg-white border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.05)] group-hover:border-amber-400'
                }`}>
                  {/* 3D Drop shadow behind emoji */}
                  <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] select-none">
                    {topProduct.icon}
                  </span>
                  {/* Absolute micro-badge trophy */}
                  <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg border ${
                    isDarkMode ? 'bg-gold border-slate-950 text-slate-950' : 'bg-amber-50 border-white text-white'
                  }`}>
                    <Trophy size={10} className="stroke-[2.5]" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={11} className="text-gold fill-gold animate-pulse animate-[spin_4s_linear_infinite]" />
                    <span className={`text-[9px] font-black uppercase tracking-[0.25em] ${isDarkMode ? 'text-gold' : 'text-amber-600'}`}>
                      {t('portfolio_alpha_sku')}
                    </span>
                  </div>
                  <h4 className={`text-xl sm:text-2xl font-black luxury-font tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {topProduct.name}
                  </h4>
                </div>
              </div>

              {/* Center: Premium Performance Telemetry */}
              <div className="flex flex-wrap items-center gap-3 lg:justify-center">
                <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  <Activity size={12} className="animate-[pulse_1.5s_infinite]" />
                  <span>{topProduct.margin.toFixed(1)}% Margin</span>
                </div>

                <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-gold/10 border-gold/20 text-gold shadow-[0_0_15px_rgba(212,175,55,0.05)]' 
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <ArrowUpRight size={12} className="stroke-[2.5]" />
                  <span>+{computedRoi.toFixed(0)}% ROI</span>
                </div>
              </div>

              {/* Right: Live Telemetry Grid */}
              <div className={`grid grid-cols-3 gap-6 lg:pl-6 lg:border-l shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{t('unit_cost')}</p>
                  <p className="text-sm font-extrabold text-rose-400 tracking-tight">{formatPrice(topProduct.unitCost)}</p>
                </div>
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{t('net_spread')}</p>
                  <p className="text-sm font-extrabold text-emerald-400 tracking-tight">{formatPrice(topProduct.sellPrice - topProduct.unitCost)}</p>
                </div>
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{t('sell_price')}</p>
                  <p className={`text-sm font-extrabold tracking-tight ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(topProduct.sellPrice)}</p>
                </div>
              </div>

            </div>

            {/* Bottom telemetry bar */}
            <div className={`px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t ${
              isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'
            }`}>
              <div className="flex-1 w-full flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest">
                  <span className={isDarkMode ? 'text-cream/40' : 'text-slate-400'}>{t('product_margin_meter')}</span>
                  <span className={isDarkMode ? 'text-gold' : 'text-amber-600'}>{topProduct.margin.toFixed(1)}% Max Cap</span>
                </div>
                
                {/* LED Equalizer Segment track */}
                <div className="flex items-center gap-1.5 w-full">
                  {Array.from({ length: totalSegments }).map((_, idx) => {
                    const isFilled = idx < filledSegments;
                    return (
                      <div
                        key={idx}
                        className={`h-2 flex-1 rounded-[3px] transition-all duration-700 ${
                          isFilled
                            ? isDarkMode
                              ? 'bg-gradient-to-t from-gold to-yellow-400 shadow-[0_0_12px_rgba(212,175,55,0.7)]'
                              : 'bg-gradient-to-t from-amber-500 to-yellow-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            : isDarkMode
                            ? 'bg-white/5'
                            : 'bg-slate-100'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className={`shrink-0 flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1.5 rounded-md border ${
                isDarkMode 
                  ? 'bg-slate-950/80 border-gold/10 text-gold/60' 
                  : 'bg-white border-amber-200/60 text-amber-700/80'
              }`}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[ping_1.5s_infinite]" />
                <span>{t('optimal_portfolio_lock_in')}</span>
              </div>
            </div>

          </div>
        );
      })()}

      {/* Profit Report Table */}
      <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className={`p-8 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('per_product_profitability')}</h3>
        </div>
        <Table>
          <TableHeader isDarkMode={isDarkMode}>
            <Th className="px-8 py-5">{t('product')}</Th>
            <Th className="px-8 py-5 text-right">{t('sell_price')}</Th>
            <Th className="px-8 py-5 text-right">{t('unit_cost')}</Th>
            <Th className="px-8 py-5 text-right">{t('margin')}</Th>
            <Th className="px-8 py-5 text-right">{t('signal')}</Th>
          </TableHeader>
          <TableBody isDarkMode={isDarkMode}>
            {normalizedReport.map((p: { name: string; icon: string; sellPrice: number; unitCost: number; margin: number; roi: number }, i: number) => {
              const isHealthy = p.margin >= 25;
              return (
                <TableRow key={i} isDarkMode={isDarkMode}>
                  <Td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.icon}</span>
                      <p className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{p.name}</p>
                    </div>
                  </Td>
                  <Td className="px-8 py-5 text-right">
                    <span className={`font-bold ${isDarkMode ? 'text-gold' : 'text-slate-900'}`}>{formatPrice(p.sellPrice)}</span>
                  </Td>
                  <Td className="px-8 py-5 text-right">
                    <span className="font-bold text-rose-400">{formatPrice(p.unitCost)}</span>
                  </Td>
                  <Td className="px-8 py-5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-bold text-sm ${isHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>{p.margin.toFixed(1)}%</span>
                      <div className={`h-1 rounded-full w-16 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <div className={`h-1 rounded-full transition-all ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(p.margin, 100)}%` }} />
                      </div>
                    </div>
                  </Td>
                  <Td className="px-8 py-5 text-right">
                    {isHealthy
                      ? <div className="flex items-center justify-end gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest"><TrendingUp size={14} /> {t('healthy')}</div>
                      : <div className="flex items-center justify-end gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest"><TrendingDown size={14} /> {t('low_margin')}</div>
                    }
                  </Td>
                </TableRow>
              );
            })}
            {normalizedReport.length === 0 && (
              <TableRow isDarkMode={isDarkMode}><Td colSpan={5} className="px-8 py-20 text-center">
                <Brain size={48} className="mx-auto mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-20">{t('no_products_found_add_products')}</p>
              </Td></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default IntelligencePanel;
