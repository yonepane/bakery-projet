/**
 * DashboardPanel — the "Home" tab of BakeryOS.
 *
 * Shows today's revenue / cost / profit KPIs, the sales area-chart,
 * the shift-handoff note feed, the monthly PDF generator, and live alerts.
 */
import React from 'react';
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
import { AlertTriangle, ChevronRight, MessageSquare, Send, Zap } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<
  DashboardSharedProps,
  | 'isDarkMode'
  | 'analytics'
  | 'formatPrice'
  | 'shiftLogs'
  | 'generalNote'
  | 'setGeneralNote'
  | 'isSavingGeneralNote'
  | 'handleSaveGeneralNote'
  | 'handleDeleteShiftLog'
  | 'alerts'
  | 'openDocument'
  | 'getDownloadToken'
  | 'handleResetSession'
  | 'API_BASE'
>;

const DashboardPanel: React.FC<Props> = ({
  isDarkMode,
  analytics,
  formatPrice,
  shiftLogs,
  generalNote,
  setGeneralNote,
  isSavingGeneralNote,
  handleSaveGeneralNote,
  handleDeleteShiftLog,
  alerts,
  openDocument,
  getDownloadToken,
  handleResetSession,
  API_BASE,
}) => {
  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {[
          { label: 'Session Revenue', value: formatPrice(analytics.today_revenue), color: isDarkMode ? 'text-cream' : 'text-slate-900' },
          { label: 'Session Cost', value: formatPrice(analytics.today_cost), color: 'text-rose-500' },
          {
            label: 'Session Profit & ROI',
            value: `${formatPrice(analytics.today_revenue - analytics.today_cost)} (${analytics.today_revenue > 0 ? (((analytics.today_revenue - analytics.today_cost) / analytics.today_revenue) * 100).toFixed(1) : 0}%)`,
            color: (analytics.today_revenue > analytics.today_cost) ? 'text-emerald-500' : 'text-rose-500',
          },
          { label: 'BOM Entities', value: analytics.intelligence.products_count, color: isDarkMode ? 'text-gold' : 'text-slate-900' },
        ].map((stat, i) => (
          <div key={i} className={`p-6 rounded-[2rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Market Performance Chart */}
        <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border min-h-[400px] transition-colors ${isDarkMode ? 'glass-panel shadow-gold-glow border-gold/20' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Market Performance</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? 'rgba(245,245,220,0.3)' : 'rgba(0,0,0,0.4)', fontSize: 10 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#121212' : '#fff', border: isDarkMode ? '1px solid rgba(212,175,55,0.2)' : '1px solid #ddd', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4} />
                <Area type="monotone" dataKey="cost" stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shift Handoff Log */}
        <div className={`p-8 rounded-[2.5rem] border flex flex-col transition-colors ${isDarkMode ? 'glass-panel shadow-gold-glow border-gold/10' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Shift Handoff Log</h3>
          <div className="flex-1 space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar scroll-smooth">
            {shiftLogs.length > 0 ? (
              shiftLogs.map((log) => (
                <div key={log.id} className={`p-4 rounded-2xl border group/log transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-slate-50 border-slate-100 hover:border-slate-200 shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gold">{log.author}</span>
                      <span className={`text-[8px] font-bold opacity-30 ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteShiftLog(log.id)} className="p-1 rounded-md opacity-0 group-hover/log:opacity-100 text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all" title="Delete note">
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-cream/80' : 'text-slate-600'}`}>{log.content}</p>
                </div>
              ))
            ) : (
              <div className="py-12 text-center opacity-10 flex flex-col items-center justify-center">
                <MessageSquare size={32} className="mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">No entries yet</p>
              </div>
            )}
          </div>
          <div className="mt-auto">
            <div className="relative">
              <textarea
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveGeneralNote(); } }}
                placeholder="Type a handoff note..."
                className={`w-full min-h-[100px] resize-none rounded-2xl border p-4 text-sm leading-relaxed outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-cream placeholder:text-cream/20 focus:border-gold/30' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400'}`}
              />
              <button
                onClick={handleSaveGeneralNote}
                disabled={isSavingGeneralNote || !generalNote.trim()}
                className={`absolute bottom-3 right-3 p-3 rounded-xl transition-all disabled:opacity-20 ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white shadow-xl'}`}
              >
                {isSavingGeneralNote ? <div className="w-4 h-4 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Financial Intelligence */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel shadow-gold-glow border-gold/10' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Financial Intelligence</h3>
          <p className={`text-sm mb-6 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Generate executive summaries for accounting and performance review.</p>
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
              Close Shift / Reset Session
            </button>
          </div>
        </div>

        {/* Live Alerts */}
        <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel shadow-gold-glow border-gold/10' : 'bg-white border-slate-200 shadow-xl'}`}>
          <h3 className={`text-xl font-bold luxury-font uppercase mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Live Alerts</h3>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-3xl border flex items-center justify-between group transition-all ${
                  alert.severity === 'high'
                    ? (isDarkMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'bg-rose-50 border-rose-100 text-rose-600')
                    : (isDarkMode ? 'bg-gold/10 border-gold/20 text-gold shadow-[0_0_20px_rgba(212,175,55,0.1)]' : 'bg-amber-50 border-amber-100 text-amber-700')
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${alert.severity === 'high' ? 'bg-rose-500/20' : 'bg-gold/20'}`}>
                    <AlertTriangle size={20} className={alert.severity === 'high' ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">{alert.type} Alert</p>
                    <p className="text-sm font-bold tracking-tight">{alert.message}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="opacity-0 group-hover:opacity-40 transition-opacity" />
              </motion.div>
            ))}
            {alerts.length === 0 && (
              <div className="py-20 opacity-10 flex flex-col items-center">
                <Zap size={48} />
                <p className="mt-4 font-bold uppercase tracking-widest text-[10px]">System Nominal</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPanel;
