import { useTranslation } from 'react-i18next';
import React from 'react';
import { useDashboard } from '../DashboardContext';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; isDarkMode: boolean }> = ({ checked, onChange, isDarkMode }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-300 focus:outline-none ${
      checked ? 'bg-gold border-gold' : isDarkMode ? 'bg-white/10 border-white/10' : 'bg-slate-200 border-slate-200'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition-transform duration-300 ${
        checked ? 'translate-x-5 bg-charcoal' : 'translate-x-0 bg-white'
      } mt-0.5 ml-0.5`}
    />
  </button>
);

/* ── Setting row with toggle ─────────────────────────────────── */
const ToggleRow: React.FC<{
  title: string; desc: string; checked: boolean;
  onChange: () => void; isDarkMode: boolean;
}> = ({ title, desc, checked, onChange, isDarkMode }) => (
  <div className={`flex items-center justify-between p-5 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
    <div>
      <p className={`font-bold text-sm mb-0.5 ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{title}</p>
      <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>{desc}</p>
    </div>
    <ToggleSwitch checked={checked} onChange={onChange} isDarkMode={isDarkMode} />
  </div>
);

/* ── Main panel ──────────────────────────────────────────────── */
const SettingsPanel: React.FC = () => {
  const { isDarkMode, settings, lang, setLang, activeCurrency, setActiveCurrency,
  setIsDarkMode, addToast, fetchData, api,
  sidebarHoverMode = false, setSidebarHoverMode, } = useDashboard();
  const { t } = useTranslation();

  const [form, setForm] = React.useState<SettingsFormState>({
    bakery_name:          settings?.bakery_name      || '',
    bakery_phone:         settings?.bakery_phone     || '',
    bakery_address:       settings?.bakery_address   || '',
    currency:             settings?.currency         || 'MAD',
    tax_rate:             settings?.tax_rate         || 0,
    receipt_footer:       settings?.receipt_footer   || '',
    hourly_wage:          settings?.hourly_wage      || 0,
    low_stock_threshold:  settings?.low_stock_threshold ?? 5,
  });

  // Local-only UI toggles persisted in localStorage
  const [autoPrint,  setAutoPrint]  = React.useState(() => localStorage.getItem('bakery_auto_print')  === 'true');
  const [soundOnSale, setSoundOnSale] = React.useState(() => localStorage.getItem('bakery_sound_sale') === 'true');

  React.useEffect(() => {
    setForm({
      bakery_name:          settings?.bakery_name      || '',
      bakery_phone:         settings?.bakery_phone     || '',
      bakery_address:       settings?.bakery_address   || '',
      currency:             settings?.currency         || 'MAD',
      tax_rate:             settings?.tax_rate         || 0,
      receipt_footer:       settings?.receipt_footer   || '',
      hourly_wage:          settings?.hourly_wage      || 0,
      low_stock_threshold:  settings?.low_stock_threshold ?? 5,
    });
  }, [settings]);

  const handleSave = async () => {
    try {
      await api.put('/settings', { ...form, language: lang, theme: isDarkMode ? 'dark' : 'light' });
      fetchData();
      addToast(t('settings_saved'), 'success');
    } catch {
      addToast(t('failed_to_save_settings'), 'error');
    }
  };

  /* shared style helpers */
  const card  = `p-8 rounded-[2.5rem] border transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`;
  const lbl   = 'text-[10px] font-black uppercase tracking-widest text-gold block mb-2';
  const inp   = `w-full bg-transparent border-b py-3 outline-none font-bold ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`;

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('settings')}</h3>

      {/* ── Bakery Identity ───────────────────────────────────── */}
      <div className={card}>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gold mb-8">{t('bakery_identity')}</h4>
        <div className="space-y-6">
          <div>
            <label className={lbl}>{t('bakery_name')}</label>
            <input value={form.bakery_name} onChange={e => setForm({ ...form, bakery_name: e.target.value })}
              placeholder={t('e_g_le_petit_four')} className={`${inp} text-lg`} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={lbl}>Phone</label>
              <input value={form.bakery_phone} onChange={e => setForm({ ...form, bakery_phone: e.target.value })}
                placeholder="+212 6XX XXX XXX" className={inp} />
            </div>
            <div>
              <label className={lbl}>Address</label>
              <input value={form.bakery_address} onChange={e => setForm({ ...form, bakery_address: e.target.value })}
                placeholder="123 Rue Mohammed V" className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>{t('receipt_footer')}</label>
            <textarea value={form.receipt_footer} onChange={e => setForm({ ...form, receipt_footer: e.target.value })}
              rows={2} placeholder={t('thank_you_for_your_visit')}
              className={`w-full bg-transparent border-b py-2 outline-none font-bold text-sm resize-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`} />
          </div>
        </div>
      </div>

      {/* ── Financial & Inventory Config ─────────────────────────────────── */}
      <div className={card}>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gold mb-8">System Configuration</h4>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className={lbl}>{t('currency')}</label>
            <select value={form.currency} onChange={e => { setForm({ ...form, currency: e.target.value }); setActiveCurrency(e.target.value); }}
              className={`appearance-none cursor-pointer pl-6 pr-12 py-4 w-full text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'}`}>
              <option value={t('mad')} className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('mad_dirham')}</option>
              <option value="EUR"      className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('eur_euro')}</option>
              <option value="USD"      className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('usd_dollar')}</option>
              <option value="GBP"      className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('gbp_pound')}</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Low Stock Alert Threshold</label>
            <p className={`text-[9px] uppercase tracking-widest mb-3 ${isDarkMode ? 'text-cream/30' : 'text-slate-400'}`}>Units before a warning appears</p>
            <input type="number" step="1" min="0" value={form.low_stock_threshold}
              onChange={e => setForm({ ...form, low_stock_threshold: parseInt(e.target.value) || 0 })}
              className={inp} />
          </div>
        </div>
      </div>

      {/* ── UI Preferences ───────────────────────────────────── */}
      <div className={card}>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gold mb-8">{t('ui_preferences')}</h4>
        <div className="space-y-6">

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={lbl}>{t('interface_language')}</label>
              <select value={lang} onChange={e => { setLang(e.target.value); localStorage.setItem('bakery_lang', e.target.value); }}
                className={`appearance-none cursor-pointer pl-6 pr-12 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all outline-none ${isDarkMode ? 'bg-black/80 border-gold/20 text-gold hover:bg-gold hover:text-charcoal' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white'}`}>
                <option value="en" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('english')}</option>
                <option value="fr" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>{t('fran_ais')}</option>
                <option value="ar" className={isDarkMode ? 'bg-[#0a0a0b] text-gold' : ''}>العربية</option>
              </select>
            </div>
            <div>
              <label className={lbl}>{t('theme_mode')}</label>
              <button onClick={() => { setIsDarkMode(!isDarkMode); localStorage.setItem('bakery_theme', !isDarkMode ? 'dark' : 'light'); }}
                className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border mt-1 ${isDarkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-900 text-white border-transparent'}`}>
                {isDarkMode ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
              </button>
            </div>
          </div>

          {/* Sidebar Hover Mode */}
          <ToggleRow
            title="Sidebar Hover Mode"
            desc="Sidebar stays collapsed — expands when you hover over it"
            checked={sidebarHoverMode}
            isDarkMode={isDarkMode}
            onChange={() => {
              const next = !sidebarHoverMode;
              setSidebarHoverMode?.(next);
              localStorage.setItem('bakery_sidebar_hover', String(next));
            }}
          />

          {/* Auto-print receipt */}
          <ToggleRow
            title="Auto-Print Receipt"
            desc="Automatically open the receipt after every completed sale"
            checked={autoPrint}
            isDarkMode={isDarkMode}
            onChange={() => {
              const next = !autoPrint;
              setAutoPrint(next);
              localStorage.setItem('bakery_auto_print', String(next));
            }}
          />

          {/* Sound on sale */}
          <ToggleRow
            title="Sound on Sale"
            desc="Play a confirmation sound when a sale is finalised"
            checked={soundOnSale}
            isDarkMode={isDarkMode}
            onChange={() => {
              const next = !soundOnSale;
              setSoundOnSale(next);
              localStorage.setItem('bakery_sound_sale', String(next));
            }}
          />
        </div>
      </div>

      <button onClick={handleSave}
        className={`w-full py-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl'}`}>
        {t('save_changes')}
      </button>
    </div>
  );
};

export default SettingsPanel;
