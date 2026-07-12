import { useTranslation } from 'react-i18next';
/**
 * DashboardPanel — the "Home" tab of BakeryOS.
 *
 * Shows today's revenue / cost / profit KPIs, the sales area-chart,
 * the shift-handoff note feed, the monthly PDF generator, and live alerts.
 */
import React from 'react';
import { useDashboard } from '../DashboardContext';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, ChevronRight, MessageSquare, Send, Zap, TrendingUp, Coins, Activity, Layers, ShieldCheck } from 'lucide-react';

const DashboardPanel: React.FC = () => {
  const { isDarkMode,
  analytics,
  formatPrice,
  shiftLogs,
  generalNote,
  setGeneralNote,
  isSavingGeneralNote,
  handleSaveGeneralNote,
  handleDeleteShiftLog,
  openDocument,
  getDownloadToken,
  handleResetSession,
  API_BASE, } = useDashboard();
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {[
          { 
            label: 'Session Revenue', 
            value: formatPrice(analytics.today_revenue), 
            color: isDarkMode ? 'text-emerald-400' : 'text-emerald-600',
            glowColor: 'hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]',
            icon: <TrendingUp size={14} className="text-emerald-400" />,
            visual: (
              <div className="flex gap-1 items-end h-5 mt-2 opacity-50">
                <div className="w-1 h-2 bg-emerald-400/40 rounded-sm" />
                <div className="w-1 h-3.5 bg-emerald-400/60 rounded-sm animate-[pulse_1.5s_infinite_150ms]" />
                <div className="w-1 h-5 bg-emerald-400 rounded-sm animate-[pulse_1.5s_infinite_300ms]" />
              </div>
            )
          },
          { 
            label: 'Session Cost', 
            value: formatPrice(analytics.today_cost), 
            color: 'text-rose-400',
            glowColor: 'hover:border-rose-500/30 hover:shadow-[0_0_30px_rgba(244,63,94,0.08)]',
            icon: <Coins size={14} className="text-rose-400" />,
            visual: (
              <div className="flex gap-1 items-end h-5 mt-2 opacity-50">
                <div className="w-1 h-5 bg-rose-400/40 rounded-sm" />
                <div className="w-1 h-3 bg-rose-400/60 rounded-sm animate-[pulse_1s_infinite_100ms]" />
                <div className="w-1 h-1.5 bg-rose-400 rounded-sm animate-[pulse_1s_infinite_200ms]" />
              </div>
            )
          },
          {
            label: 'Session Profit & ROI',
            value: `${formatPrice(analytics.today_revenue - analytics.today_cost)}`,
            subValue: `${analytics.today_revenue > 0 ? (((analytics.today_revenue - analytics.today_cost) / analytics.today_revenue) * 100).toFixed(1) : 0}% ROI`,
            color: (analytics.today_revenue > analytics.today_cost) ? 'text-emerald-400' : 'text-rose-400',
            glowColor: (analytics.today_revenue > analytics.today_cost) 
              ? 'hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]' 
              : 'hover:border-rose-500/30 hover:shadow-[0_0_30px_rgba(244,63,94,0.08)]',
            icon: <Activity size={14} className="text-gold" />,
            visual: (() => {
              const profitVal = analytics.today_revenue - analytics.today_cost;
              const roi = analytics.today_revenue > 0 ? ((profitVal / analytics.today_revenue) * 100) : 0;
              const radius = 8;
              const strokeWidth = 2;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (Math.min(Math.max(roi, 0), 100) / 100) * circumference;
              return (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black tracking-wider ${isDarkMode ? 'text-gold/80' : 'text-amber-700'}`}>
                    {analytics.today_revenue > 0 ? `${roi.toFixed(0)}% ROI` : '0% ROI'}
                  </span>
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r={radius} stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth={strokeWidth} fill="transparent" />
                    <circle cx="12" cy="12" r={radius} stroke="#d4af37" strokeWidth={strokeWidth} fill="transparent" 
                      strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                  </svg>
                </div>
              );
            })()
          },
          { 
            label: 'BOM Entities', 
            value: String(analytics.intelligence.products_count), 
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
        ].map((stat, i) => (
          <div 
            key={i} 
            className={`group p-6 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between ${
              isDarkMode 
                ? `bg-[#0a0a0b] border-white/5 shadow-glass ${stat.glowColor} hover:-translate-y-0.5` 
                : `bg-white border-slate-200 shadow-xl hover:border-slate-300 hover:-translate-y-0.5 ${stat.glowColor}`
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'text-cream/35' : 'text-slate-400'}`}>{stat.label}</p>
                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                  {stat.icon}
                </div>
              </div>
              <p className={`text-3xl font-black luxury-font tracking-tight ${stat.color}`}>{stat.value}</p>
            </div>
            
            {/* Embedded Micro-Telemetry Graphic */}
            <div className="flex justify-end items-center mt-4">
              {stat.visual}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Market Performance Chart */}
        <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border min-h-[400px] transition-all duration-500 hover:-translate-y-0.5 ${
          isDarkMode 
            ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' 
            : 'bg-white border-slate-200 shadow-xl'
        }`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className={`text-xl font-bold luxury-font uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('market_performance')}</h3>
              <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-cream/35' : 'text-slate-400'}`}>{t('live_revenue_cost_timeline_ana')}</p>
            </div>
            
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
              isDarkMode 
                ? 'bg-slate-950/80 border-gold/10 text-gold/80' 
                : 'bg-amber-50 border-amber-200/60 text-amber-800'
            }`}>
              <Activity size={10} className="animate-pulse" />
              <span>{t('holographic_telemetry')}</span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                  {/* Neon laser-beam glow filter */}
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="5 5" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? 'rgba(245,245,220,0.35)' : 'rgba(0,0,0,0.4)', fontSize: 9, fontWeight: 700 }} />
                <YAxis hide />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const rev = Number(payload[0].value) || 0;
                      const cost = Number(payload[1]?.value) || 0;
                      const profit = rev - cost;
                      return (
                        <div className={`p-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 shadow-2xl ${
                          isDarkMode 
                            ? 'bg-slate-950/90 border-white/10 text-white shadow-[0_10px_40px_rgba(0,0,0,0.6)]' 
                            : 'bg-white/90 border-slate-200 text-slate-900 shadow-lg'
                        }`}>
                          <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${isDarkMode ? 'text-gold' : 'text-amber-600'}`}>{label} Status</p>
                          <div className="space-y-1.5 text-[10px] font-bold">
                            <div className="flex justify-between gap-8">
                              <span className="opacity-60 uppercase tracking-widest">{t('revenue')}</span>
                              <span className="text-emerald-400 font-extrabold">{formatPrice(Number(rev))}</span>
                            </div>
                            <div className="flex justify-between gap-8">
                              <span className="opacity-60 uppercase tracking-widest">{t('cost')}</span>
                              <span className="text-rose-400 font-extrabold">{formatPrice(Number(cost))}</span>
                            </div>
                            <div className={`h-[1px] my-1.5 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`} />
                            <div className="flex justify-between gap-8 text-[11px] font-black uppercase tracking-wider">
                              <span>{t('net_profit')}</span>
                              <span className={profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatPrice(profit)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#D4AF37" 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  strokeWidth={3} 
                  filter="url(#neonGlow)"
                  activeDot={{ 
                    r: 5.5, 
                    stroke: '#D4AF37', 
                    strokeWidth: 2, 
                    fill: isDarkMode ? '#030303' : '#fff',
                    className: 'transition-all duration-300'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cost" 
                  stroke={isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} 
                  fill="transparent" 
                  strokeWidth={1.5} 
                  strokeDasharray="4 4" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shift Handoff Log */}
        <div className={`p-8 rounded-[2.5rem] border flex flex-col transition-colors ${isDarkMode ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('shift_handoff_log')}</h3>
          <div className="flex-1 space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar scroll-smooth">
            {shiftLogs.length > 0 ? (
              shiftLogs.map((log) => (
                <div key={log.id} className={`p-4 rounded-2xl border group/log transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-slate-50 border-slate-100 hover:border-slate-200 shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gold">{log.username}</span>
                      <span className={`text-[8px] font-bold opacity-30 ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteShiftLog(log.id)} className="p-1 rounded-md opacity-0 group-hover/log:opacity-100 text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all" title={t('delete_note')}>
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-cream/80' : 'text-slate-600'}`}>{log.details || log.action}</p>
                </div>
              ))
            ) : (
              <div className="py-12 text-center opacity-10 flex flex-col items-center justify-center">
                <MessageSquare size={32} className="mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">{t('no_entries_yet')}</p>
              </div>
            )}
          </div>
          <div className="mt-auto">
            <div className="relative">
              <textarea
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                onBlur={() => handleSaveGeneralNote(generalNote)}
                disabled={isSavingGeneralNote}
                placeholder={t('type_a_handoff_note')}
                className={`w-full bg-transparent resize-none outline-none text-sm font-medium leading-relaxed
                  ${isDarkMode ? 'text-cream/80 placeholder:text-cream/20' : 'text-slate-600 placeholder:text-slate-400'}
                `}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    (e.target as HTMLTextAreaElement).blur();
                  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSaveGeneralNote(generalNote);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Financial Intelligence */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'bg-[#0a0a0b] border-white/5 shadow-glass backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('financial_intelligence')}</h3>
          <p className={`text-sm mb-6 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('generate_executive_summaries_f')}</p>
          <div className="flex gap-4">
            <button
              onClick={async () => {
                const year = new Date().getFullYear();
                const month = new Date().getMonth() + 1;
                const dlToken = await getDownloadToken();
                openDocument(`${API_BASE}/reports/monthly?month=${month}&year=${year}&format=pdf&token=${dlToken}`, `monthly-report-${year}-${month}.pdf`);
              }}
              className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${isDarkMode ? 'border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-900 text-white shadow-xl'}`}
            >
              Generate {new Date().toLocaleString('default', { month: 'long' })} Report
            </button>
            <button onClick={handleResetSession} className="px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-gold/20 text-gold hover:bg-gold hover:text-charcoal transition-all">
              {t('reset_session')}
            </button>
          </div>
        </div>

        </div>
      </div>
  );
};

export default DashboardPanel;
