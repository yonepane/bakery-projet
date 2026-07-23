import { useTranslation } from 'react-i18next';
import React from 'react';
import { useUISelector, useServerDataSelector, useModalSelector } from '../DashboardContext';
import { Plus, Trash2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, Th, Td } from '../../ui/Table';

const ExpensesPanel: React.FC = () => {
  const { isDarkMode, formatPrice } = useUISelector();
  const { expenses } = useServerDataSelector();
  const { setShowAddExpense } = useModalSelector();
  const { t } = useTranslation();
  return (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex justify-between items-center">
      <div>
        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('expenses_1')}</h3>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('track_business_overhead_bills')}</p>
      </div>
      <button onClick={() => setShowAddExpense(true)} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
        <Plus size={16} /> {t('log_new_expense')}
      </button>
    </div>
    <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
      <Table>
        <TableHeader isDarkMode={isDarkMode}>
          <Th>{t('date')}</Th>
          <Th>{t('category')}</Th>
          <Th>{t('description')}</Th>
          <Th className="text-right">{t('amount')}</Th>
        </TableHeader>
        <TableBody isDarkMode={isDarkMode}>
          {expenses.map((exp) => (
            <TableRow key={exp.id} isDarkMode={isDarkMode}>
              <Td className="font-bold text-sm">{new Date(exp.date).toLocaleDateString()}</Td>
              <Td><span className="text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{exp.category}</span></Td>
              <Td className={`text-sm ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>{exp.description}</Td>
              <Td className="text-right font-bold text-rose-500">-{formatPrice(exp.amount)}</Td>
            </TableRow>
          ))}
          {expenses.length === 0 && (
            <TableRow isDarkMode={isDarkMode}>
              <Td className="py-20 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">
                {t('no_expenses_logged')}
              </Td>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  </div>
  );
};

export default ExpensesPanel;
