import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { useDashboard } from '../DashboardContext';
import { Users, Plus, Star, Phone, Mail, Trash2, X } from 'lucide-react';

const CustomersPanel: React.FC = () => {
  const { isDarkMode, customers, api, addToast, fetchData, showConfirm } = useDashboard();
  const { t } = useTranslation();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      addToast(t('name_is_required'), "error");
      return;
    }
    try {
      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer.id}`, formData);
        addToast(t('customer_updated'), "success");
      } else {
        await api.post('/customers', formData);
        addToast(t('customer_created'), "success");
      }
      setShowAddModal(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '' });
      fetchData();
    } catch (e: any) {
      addToast(editingCustomer ? "Update failed" : "Creation failed", "error");
    }
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || ''
    });
    setShowAddModal(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('loyalty_crm')}</h3>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('manage_customers_desc')}</p>
        </div>
        <button
          onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', email: '' });
            setShowAddModal(true);
          }}
          className={`px-6 py-4 rounded-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl hover:bg-slate-800'}`}
        >
          <Plus size={16} /> {t('new_member')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map(customer => (
          <div key={customer.id} className={`p-8 rounded-[2.5rem] border group transition-all relative overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-gold/20' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Star size={100} />
            </div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-2xl font-bold luxury-font tracking-tight mb-1">{customer.name}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gold">ID: {customer.id}</p>
                </div>
                <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 ${isDarkMode ? 'bg-gold/10 text-gold' : 'bg-amber-100 text-amber-700'}`}>
                  <Star size={14} className="fill-current" />
                  <span className="font-bold">{customer.points}</span>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {customer.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={14} className="opacity-40" />
                    <span className={isDarkMode ? 'text-cream/80' : 'text-slate-600'}>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={14} className="opacity-40" />
                    <span className={isDarkMode ? 'text-cream/80' : 'text-slate-600'}>{customer.email}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => openEdit(customer)}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  {t('edit_profile')}
                </button>
                <button
                  onClick={() => showConfirm({
                    title: 'Delete Customer',
                    message: `Remove ${customer.name} from the CRM? This cannot be undone if they have no transaction history.`,
                    type: 'danger',
                    confirmText: 'Delete',
                    onConfirm: async () => {
                      try {
                        await api.delete(`/customers/${customer.id}`);
                        addToast(t('customer_removed'), 'success');
                        fetchData();
                      } catch (e: any) {
                        const detail = e.response?.data?.detail || 'Delete failed';
                        addToast(detail, 'error');
                      }
                    },
                  })}
                  className={`p-4 rounded-2xl text-[10px] font-black transition-all ${
                    isDarkMode
                      ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                      : 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                  }`}
                  title={t('delete_customer')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-20">
            <Users size={48} className="mb-4" />
            <p className="font-black text-xs uppercase tracking-widest">{t('no_members_yet')}</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-md p-10 luxury-panel">
            <div className="flex justify-between items-start mb-10">
              <h3 className={`text-2xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {editingCustomer ? 'Edit Profile' : 'New Member'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('full_name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('e_g_jean_dupont')}
                  className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('phone_number')}</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+212..."
                  className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">{t('email_address')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('customer_email_com')}
                  className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'}`}
                />
              </div>

              <button
                onClick={handleSave}
                className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105' : 'bg-slate-900 text-white shadow-xl'}`}
              >
                {editingCustomer ? 'Update Member' : 'Register Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPanel;
