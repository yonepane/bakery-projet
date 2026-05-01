import React from 'react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'settings' | 'lang' | 'setLang' | 'activeCurrency' | 'setActiveCurrency' |
  'isDarkMode' | 'setIsDarkMode' | 'addToast' | 'fetchData' | 'api'>;

interface SettingsFormState {
  bakery_name: string;
  currency: string;
  tax_rate: number;
  receipt_footer: string;
  hourly_wage: number;
}

const SettingsPanel: React.FC<Props & { settings: any }> = ({
  isDarkMode, settings, lang, setLang, activeCurrency, setActiveCurrency,
  setIsDarkMode, addToast, fetchData, api,
}) => {
  const [form, setForm] = React.useState<SettingsFormState>({
    bakery_name: settings?.bakery_name || '',
    currency: settings?.currency || 'MAD',
    tax_rate: settings?.tax_rate || 0,
    receipt_footer: settings?.receipt_footer || '',
    hourly_wage: settings?.hourly_wage || 0,
  });

  React.useEffect(() => {
    setForm({
      bakery_name: settings?.bakery_name || '',
      currency: settings?.currency || 'MAD',
      tax_rate: settings?.tax_rate || 0,
      receipt_footer: settings?.receipt_footer || '',
      hourly_wage: settings?.hourly_wage || 0,
    });
  }, [settings]);

  const handleSave = async () => {
    try {
      await api.put('/settings', { ...form, language: lang, theme: isDarkMode ? 'dark' : 'light' });
      fetchData();
      addToast('Settings saved', 'success');
    } catch {
      addToast('Failed to save settings', 'error');
    }
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
      <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Settings</h3>

      {/* Bakery Identity */}
      <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gold mb-8">Bakery Identity</h4>
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Bakery Name</label>
            <input value={form.bakery_name} onChange={e => setForm({ ...form, bakery_name: e.target.value })}
              placeholder="e.g. Le Petit Four" className={`w-full bg-transparent border-b py-3 outline-none font-bold text-lg ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Receipt Footer</label>
            <textarea value={form.receipt_footer} onChange={e => setForm({ ...form, receipt_footer: e.target.value })}
              rows={2} placeholder="Thank you for your visit!" className={`w-full bg-transparent border-b py-2 outline-none font-bold text-sm resize-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
          </div>
        </div>
      </div>

      {/* Financial Config */}
      <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gold mb-8">Financial Config</h4>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Currency</label>
            <select value={form.currency} onChange={e => { setForm({ ...form, currency: e.target.value }); setActiveCurrency(e.target.value); }}
              className={`appearance-none cursor-pointer pl-6 pr-12 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'}`}>
              <option value="MAD" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>MAD (Dirham)</option>
              <option value="EUR" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>EUR (Euro)</option>
              <option value="USD" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>USD (Dollar)</option>
              <option value="GBP" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>GBP (Pound)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Tax Rate (%)</label>
            <input type="number" step="0.01" min="0" max="100" value={form.tax_rate}
              onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">⏱ Baseline Hourly Wage (per hour)</label>
            <p className={`text-[9px] uppercase tracking-widest mb-3 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Used by the Labor Cost Engine to compute True Net Profit on each recipe.</p>
            <input type="number" step="0.01" min="0" value={form.hourly_wage}
              onChange={e => setForm({ ...form, hourly_wage: parseFloat(e.target.value) || 0 })}
              className={`w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
          </div>
        </div>
      </div>

      {/* UI Preferences */}
      <div className={`p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gold mb-8">UI Preferences</h4>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">Interface Language</label>
            <select value={lang} onChange={e => { setLang(e.target.value); localStorage.setItem('bakery_lang', e.target.value); }}
              className={`appearance-none cursor-pointer pl-6 pr-12 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'}`}>
              <option value="en" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>English</option>
              <option value="fr" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>Français</option>
              <option value="ar" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>العربية</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-4">Theme Mode</label>
            <button onClick={() => { setIsDarkMode(!isDarkMode); localStorage.setItem('bakery_theme', !isDarkMode ? 'dark' : 'light'); }}
              className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-900 text-white border-transparent'}`}>
              {isDarkMode ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
            </button>
          </div>
        </div>
      </div>

      <button onClick={handleSave}
        className={`w-full py-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl'}`}>
        Save Changes
      </button>
    </div>
  );
};

export default SettingsPanel;
