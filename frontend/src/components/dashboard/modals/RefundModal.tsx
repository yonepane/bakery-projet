import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Modal, ModalHeader } from '../../ui/Modal';

interface RefundProps {
  tx: any;
  isDarkMode: boolean;
  formatPrice: (amount: number) => string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export const RefundModal: React.FC<RefundProps> = ({
  tx,
  isDarkMode,
  formatPrice,
  onConfirm,
  onCancel,
  loading,
}) => {
  const { t } = useTranslation();

  if (!tx) return null;

  return (
    <Modal isOpen={!!tx} onClose={onCancel} isDarkMode={isDarkMode} maxWidth="max-w-md">
      <ModalHeader
        title={t('cancel_sale') || 'Cancel Sale'}
        icon={AlertTriangle}
        iconColor="text-rose-500"
        iconBg="bg-rose-500/10"
        onClose={onCancel}
        isDarkMode={isDarkMode}
      />

      {/* Transaction Info */}
      <div
        className={`p-5 rounded-2xl mb-5 border ${
          isDarkMode ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-100'
        }`}
      >
        <p
          className={`text-[10px] font-black uppercase tracking-widest mb-3 ${
            isDarkMode ? 'text-cream/40' : 'text-slate-400'
          }`}
        >
          {t('transaction') || 'Transaction'}:{' '}
          <span className={`font-mono ${isDarkMode ? 'text-gold' : 'text-slate-700'}`}>
            {tx.id}
          </span>
        </p>
        <div className="space-y-1.5 mb-3">
          {(typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items)?.map(
            (item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className={`font-medium ${isDarkMode ? 'text-cream/70' : 'text-slate-600'}`}>
                  {item.name} × {item.qty}
                </span>
                <span className={`font-bold ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>
                  {formatPrice(item.price * item.qty)}
                </span>
              </div>
            ),
          )}
        </div>
        <div
          className={`pt-3 border-t flex justify-between ${
            isDarkMode ? 'border-white/5' : 'border-slate-200'
          }`}
        >
          <span
            className={`text-xs font-black uppercase tracking-widest ${
              isDarkMode ? 'text-cream/40' : 'text-slate-400'
            }`}
          >
            {t('total') || 'Total'}
          </span>
          <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {formatPrice(tx.revenue || 0)}
          </span>
        </div>
      </div>

      {/* Warning */}
      <p className={`text-sm mb-6 text-center ${isDarkMode ? 'text-cream/50' : 'text-slate-500'}`}>
        {t('refund_warning') || 'Stock will be restored. This action cannot be undone.'}
      </p>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border ${
            isDarkMode
              ? 'border-white/10 text-cream/60 hover:bg-white/5 hover:text-cream'
              : 'border-slate-200 text-slate-500 hover:bg-slate-100'
          }`}
        >
          {t('keep') || 'Keep'}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all bg-rose-500 text-white hover:bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.35)] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <RotateCcw size={14} />
          )}
          {loading ? t('cancelling') || 'Cancelling…' : t('confirm_cancel') || 'Confirm Cancel'}
        </button>
      </div>
    </Modal>
  );
};
