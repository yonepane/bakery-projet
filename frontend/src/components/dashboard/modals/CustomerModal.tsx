import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { Modal, ModalHeader } from '../../ui/Modal';
import type { Customer } from '../types';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  editingCustomer: Customer | null;
  formData: { name: string; phone: string; email: string };
  setFormData: (data: { name: string; phone: string; email: string }) => void;
  onSave: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  editingCustomer,
  formData,
  setFormData,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} isDarkMode={isDarkMode} maxWidth="max-w-md">
      <ModalHeader
        title={editingCustomer ? 'Edit Profile' : 'New Member'}
        icon={Users}
        onClose={onClose}
        isDarkMode={isDarkMode}
      />

      <div className="space-y-8 mt-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">
            {t('full_name')}
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t('e_g_jean_dupont')}
            className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${
              isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'
            }`}
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">
            {t('phone_number')}
          </label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+212..."
            className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${
              isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'
            }`}
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-gold block mb-2">
            {t('email_address')}
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder={t('customer_email_com')}
            className={`w-full bg-transparent border-b text-lg font-bold py-4 outline-none ${
              isDarkMode ? 'border-white/10 text-cream' : 'border-slate-200 text-slate-900'
            }`}
          />
        </div>

        <button
          onClick={onSave}
          className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all ${
            isDarkMode
              ? 'bg-gold text-charcoal shadow-gold-glow hover:scale-105'
              : 'bg-slate-900 text-white shadow-xl'
          }`}
        >
          {editingCustomer ? 'Update Member' : 'Register Member'}
        </button>
      </div>
    </Modal>
  );
};
