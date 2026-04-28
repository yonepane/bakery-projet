import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DashboardSharedProps } from '../types';

type Props = Pick<DashboardSharedProps,
  'isDarkMode' | 'expenses' | 'formatPrice' | 'setShowAddExpense'>;

const ExpensesPanel: React.FC<Props> = ({ isDarkMode, expenses, formatPrice, setShowAddExpense }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex justify-between items-center">
      <div>
        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Expenses</h3>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Track business overhead, bills, and payroll</p>
      </div>
      <button onClick={() => setShowAddExpense(true)} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
        <Plus size={16} /> Log New Expense
      </button>
    </div>
    <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
      <table className="w-full text-left">
        <thead>
          <tr className={`border-b text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'border-white/5 text-cream/40' : 'border-slate-100 text-slate-400'}`}>
            <th className="px-8 py-6">Date</th>
            <th className="px-8 py-6">Category</th>
            <th className="px-8 py-6">Description</th>
            <th className="px-8 py-6 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp) => (
            <tr key={exp.id} className={`border-b last:border-0 ${isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'} transition-colors`}>
              <td className="px-8 py-6 font-bold text-sm">{new Date(exp.date).toLocaleDateString()}</td>
              <td className="px-8 py-6"><span className="text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{exp.category}</span></td>
              <td className={`px-8 py-6 text-sm ${isDarkMode ? 'text-cream/40' : 'text-slate-500'}`}>{exp.description}</td>
              <td className="px-8 py-6 text-right font-bold text-rose-500">-{formatPrice(exp.amount)}</td>
            </tr>
          ))}
          {expenses.length === 0 && <tr><td colSpan={4} className="py-20 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">No expenses logged yet</td></tr>}
        </tbody>
      </table>
    </div>
  </div>
);

export default ExpensesPanel;
