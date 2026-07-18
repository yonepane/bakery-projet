import React, { useMemo, useState } from 'react';
import { useDashboard } from '../DashboardContext';
import { Activity, ArrowDown, ArrowUp, Boxes, Package, Search } from 'lucide-react';
import type { StockMovement } from '../types';
import { Table, TableHeader, TableBody, TableRow, Th, Td } from '../../ui/Table';
import { TabStrip } from '../../ui/TabStrip';
import { SearchInput } from '../../ui/SearchInput';

const movementStyles: Record<string, string> = {
  sale: 'bg-rose-500/10 text-rose-500',
  refund: 'bg-emerald-500/10 text-emerald-500',
  production_input: 'bg-amber-500/10 text-amber-500',
  production_output: 'bg-emerald-500/10 text-emerald-500',
  purchase_receipt: 'bg-sky-500/10 text-sky-500',
  adjustment: 'bg-gold/10 text-gold',
  waste: 'bg-rose-500/10 text-rose-500',
};

const formatQty = (value: number, unit?: string | null) => {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted}${unit ? ` ${unit}` : ''}`;
};

const formatMovementType = (value: string) => value.replace(/_/g, ' ');

const StockMovementsPanel: React.FC = () => {
  const { isDarkMode, stockMovements } = useDashboard();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'ingredient'>('all');
  const [movementFilter, setMovementFilter] = useState('all');

  const movementTypes = useMemo(() => {
    return Array.from(new Set(stockMovements.map(m => m.movement_type))).sort();
  }, [stockMovements]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stockMovements.filter((movement) => {
      const matchesType = typeFilter === 'all' || movement.item_type === typeFilter;
      const matchesMovement = movementFilter === 'all' || movement.movement_type === movementFilter;
      const matchesSearch = !query ||
        movement.item_name?.toLowerCase().includes(query) ||
        movement.item_id?.toLowerCase().includes(query) ||
        movement.reason?.toLowerCase().includes(query) ||
        movement.source_id?.toLowerCase().includes(query);
      return matchesType && matchesMovement && matchesSearch;
    });
  }, [stockMovements, search, typeFilter, movementFilter]);

  const inbound = filtered.filter(m => m.quantity_delta > 0).length;
  const outbound = filtered.filter(m => m.quantity_delta < 0).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h3 className={`text-4xl font-bold luxury-font uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Stock Ledger</h3>
        <p className={`text-sm mt-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>Inventory movements by source, quantity, and stock balance.</p>
      </div>

      <div className={`p-6 rounded-[2rem] border flex flex-wrap items-center gap-5 ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <TabStrip
          tabs={[
            { value: 'all', label: 'all' },
            { value: 'product', label: 'product' },
            { value: 'ingredient', label: 'ingredient' },
          ]}
          active={typeFilter}
          onChange={(v) => setTypeFilter(v as any)}
          isDarkMode={isDarkMode}
        />

        <select
          value={movementFilter}
          onChange={event => setMovementFilter(event.target.value)}
          className={`px-4 py-2 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-cream' : 'bg-white border-slate-200 text-slate-700'}`}
        >
          <option value="all">All movements</option>
          {movementTypes.map(type => (
            <option key={type} value={type}>{formatMovementType(type)}</option>
          ))}
        </select>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search item, source, or reason"
          isDarkMode={isDarkMode}
          className="min-w-[220px]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: 'Movements', value: String(filtered.length), icon: <Activity size={20} />, color: isDarkMode ? 'text-gold' : 'text-slate-900' },
          { label: 'Inbound', value: String(inbound), icon: <ArrowUp size={20} />, color: 'text-emerald-400' },
          { label: 'Outbound', value: String(outbound), icon: <ArrowDown size={20} />, color: 'text-rose-400' },
        ].map(kpi => (
          <div key={kpi.label} className={`p-6 rounded-[2rem] border transition-all ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className={`mb-3 ${kpi.color}`}>{kpi.icon}</div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-[2rem] border overflow-hidden transition-colors ${isDarkMode ? 'glass-panel' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'} flex justify-between items-center`}>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader isDarkMode={isDarkMode}>
              <Th>Time</Th>
              <Th>Item</Th>
              <Th>Movement</Th>
              <Th className="text-right">Delta</Th>
              <Th className="text-right">Balance</Th>
              <Th>Source</Th>
            </TableHeader>
            <TableBody isDarkMode={isDarkMode}>
              {filtered.map((movement: StockMovement) => {
                const isPositive = movement.quantity_delta > 0;
                const badgeClass = movementStyles[movement.movement_type] || (isDarkMode ? 'bg-white/5 text-cream/50' : 'bg-slate-100 text-slate-600');
                return (
                  <TableRow key={movement.id} isDarkMode={isDarkMode}>
                    <Td className={`font-medium text-xs whitespace-nowrap ${isDarkMode ? 'text-cream/40' : 'text-slate-400'}`}>
                      {movement.created_at ? new Date(movement.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-gold' : 'bg-slate-100 text-slate-700'}`}>
                          {movement.item_type === 'product' ? <Package size={16} /> : <Boxes size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-bold text-sm truncate ${isDarkMode ? 'text-cream' : 'text-slate-900'}`}>{movement.item_name || movement.item_id}</p>
                          <p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-cream/20' : 'text-slate-400'}`}>{movement.item_type}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className={`w-max px-2 py-1 rounded-[6px] text-[10px] font-black uppercase tracking-widest ${badgeClass}`}>
                          {formatMovementType(movement.movement_type)}
                        </span>
                        {movement.reason && <p className={`text-xs italic truncate max-w-[200px] ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>"{movement.reason}"</p>}
                      </div>
                    </Td>
                    <Td className={`text-right font-bold text-sm ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isPositive ? '+' : ''}{formatQty(movement.quantity_delta, movement.unit)}
                    </Td>
                    <Td className={`text-right font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {formatQty(movement.after_qty, movement.unit)}
                    </Td>
                    <Td>
                      {movement.source_id ? (
                        <p className={`font-mono text-[10px] bg-black/20 p-1 rounded inline-block ${isDarkMode ? 'text-cream/40 border border-white/5' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {movement.source_id.split('-')[0]}
                        </p>
                      ) : (
                        <span className="text-[10px] text-slate-500">-</span>
                      )}
                    </Td>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow isDarkMode={isDarkMode}>
                  <Td colSpan={6} className="px-8 py-24 text-center">
                    <Search size={40} className="mx-auto mb-4 opacity-10" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-20">No stock movements match</p>
                  </Td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default StockMovementsPanel;
