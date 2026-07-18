import React from 'react';
import { useDashboard } from '../DashboardContext';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableBody, TableRow, Th, Td } from '../../ui/Table';

const StaffPanel: React.FC = () => {
  const { isDarkMode, staff, handleDeleteStaff, setShowAddStaff } = useDashboard();
  const { t } = useTranslation();
  
  return (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex justify-between items-center">
      <div>
        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('staff')}</h3>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{t('manage_team_desc')}</p>
      </div>
      <button onClick={() => setShowAddStaff(true)} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${isDarkMode ? 'bg-gold text-charcoal shadow-gold-glow' : 'bg-slate-900 text-white'}`}>
        <Plus size={16} /> {t('add_staff')}
      </button>
    </div>
    <div className={`rounded-[2.5rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
      <Table>
        <TableHeader isDarkMode={isDarkMode}>
          <Th className="px-8 py-6">{t('username')}</Th>
          <Th className="px-8 py-6">{t('role')}</Th>
          <Th className="px-8 py-6 text-right">{t('actions')}</Th>
        </TableHeader>
        <TableBody isDarkMode={isDarkMode}>
          {staff.map((member) => (
            <TableRow key={member.id} isDarkMode={isDarkMode}>
              <Td className="font-bold text-sm">{member.username}</Td>
              <Td><span className="text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">{member.role}</span></Td>
              <Td className="text-right">
                <button onClick={() => handleDeleteStaff(member.username)} className="text-rose-500/20 hover:text-rose-500 transition-colors p-2"><Trash2 size={16} /></button>
              </Td>
            </TableRow>
          ))}
          {staff.length === 0 && (
            <TableRow isDarkMode={isDarkMode}>
              <Td colSpan={3} className="py-20 text-center opacity-10 font-black uppercase tracking-widest text-[10px]">
                {t('no_staff_yet')}
              </Td>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  </div>
  );
};

export default StaffPanel;
