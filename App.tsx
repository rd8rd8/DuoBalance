
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  History, 
  Settings as SettingsIcon, 
  Wallet, 
  ArrowRightLeft, 
  X, 
  RotateCcw,
  CheckCircle2,
  Trash2,
  BarChart3,
  PieChart,
  Home,
  AlertCircle,
  TrendingUp,
  Users,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { Expense, Batch, Category, Payer, AppState } from './types';
import { INITIAL_STATE, LOCAL_STORAGE_KEY } from './constants';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_STATE;
  });

  const [view, setView] = useState<'main' | 'history' | 'stats' | 'settings'>('main');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBatchExpenses, setSelectedBatchExpenses] = useState<Batch | null>(null);
  
  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Calculations for current period (aberto)
  const totals = useMemo(() => {
    const ricardoTotal = state.expenses
      .filter(e => e.payer === 'Ricardo')
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const rafaelaTotal = state.expenses
      .filter(e => e.payer === 'Rafaela')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const diff = ricardoTotal - rafaelaTotal;
    const balance = Math.abs(diff) / 2;
    const whoOwes: Payer | 'None' = diff > 0 ? 'Rafaela' : diff < 0 ? 'Ricardo' : 'None';

    return { ricardoTotal, rafaelaTotal, balance, whoOwes };
  }, [state.expenses]);

  // Comprehensive Statistics Data: Stats per batch + Global
  const stats = useMemo(() => {
    const getCategoryBreakdown = (expenses: Expense[]) => {
      const catTotals: Record<string, number> = {};
      expenses.forEach(e => {
        catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + e.amount;
      });
      return state.categories
        .map(c => ({ ...c, total: catTotals[c.id] || 0 }))
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total);
    };

    // 1. Stats for Current Period (Fecho em aberto)
    const currentPeriodStats = {
      name: 'Período em Aberto',
      total: totals.ricardoTotal + totals.rafaelaTotal,
      ricardo: totals.ricardoTotal,
      rafaela: totals.rafaelaTotal,
      categories: getCategoryBreakdown(state.expenses)
    };

    // 2. Stats for Past Batches (Fechos concluídos)
    const batchStats = state.batches.map(batch => ({
      id: batch.id,
      name: batch.name,
      settledAt: batch.settledAt,
      total: batch.totalRicardo + batch.totalRafaela,
      ricardo: batch.totalRicardo,
      rafaela: batch.totalRafaela,
      categories: getCategoryBreakdown(batch.expenses)
    }));

    // 3. Global Stats (Geral)
    const allHistoricalExpenses = state.batches.flatMap(b => b.expenses);
    const combinedExpenses = [...state.expenses, ...allHistoricalExpenses];
    
    const globalCategories = getCategoryBreakdown(combinedExpenses);
    const ricardoAllTime = combinedExpenses.filter(e => e.payer === 'Ricardo').reduce((a, b) => a + b.amount, 0);
    const rafaelaAllTime = combinedExpenses.filter(e => e.payer === 'Rafaela').reduce((a, b) => a + b.amount, 0);
    const totalAllTime = ricardoAllTime + rafaelaAllTime;

    return { currentPeriodStats, batchStats, globalCategories, ricardoAllTime, rafaelaAllTime, totalAllTime };
  }, [state.expenses, state.batches, state.categories, totals]);

  // Actions
  const triggerConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'info' | 'warning' = 'info') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
  };

  const addExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };
    setState(prev => ({ ...prev, expenses: [newExpense, ...prev.expenses] }));
    setIsModalOpen(false);
  };

  const deleteExpense = (id: string) => {
    triggerConfirm(
      'Apagar Despesa',
      'Deseja apagar esta despesa permanentemente?',
      () => {
        setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
        setConfirmDialog(p => ({ ...p, isOpen: false }));
      },
      'danger'
    );
  };

  const settleAccounts = () => {
    if (state.expenses.length === 0) return;
    
    const msg = totals.whoOwes !== 'None' 
      ? `Confirma que a/o ${totals.whoOwes} já pagou os ${totals.balance.toFixed(2)}€? O histórico atual será arquivado.`
      : 'Deseja fechar o período atual e arquivar as despesas?';

    triggerConfirm(
      'Fechar Contas',
      msg,
      () => {
        const newBatch: Batch = {
          id: crypto.randomUUID(),
          name: `Fecho de ${new Date().toLocaleDateString('pt-PT')}`,
          expenses: [...state.expenses],
          settledAt: Date.now(),
          totalRicardo: totals.ricardoTotal,
          totalRafaela: totals.rafaelaTotal,
          balance: totals.balance,
          payerWhoOwes: totals.whoOwes
        };

        setState(prev => ({
          ...prev,
          expenses: [],
          batches: [newBatch, ...prev.batches]
        }));
        setView('history');
        setConfirmDialog(p => ({ ...p, isOpen: false }));
      },
      'warning'
    );
  };

  const revertBatch = (batchId: string) => {
    triggerConfirm(
      'Reverter Fecho',
      'As despesas deste período voltarão para a lista principal. Continuar?',
      () => {
        const batch = state.batches.find(b => b.id === batchId);
        if (!batch) return;

        setState(prev => ({
          ...prev,
          expenses: [...batch.expenses, ...prev.expenses].sort((a, b) => b.createdAt - a.createdAt),
          batches: prev.batches.filter(b => b.id !== batchId)
        }));
        setView('main');
        setConfirmDialog(p => ({ ...p, isOpen: false }));
      },
      'info'
    );
  };

  const addCategory = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-orange-100 text-orange-700',
      'bg-pink-100 text-pink-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700',
      'bg-gray-100 text-gray-700'
    ];
    const newCategory: Category = {
      id: crypto.randomUUID(),
      name,
      color: colors[state.categories.length % colors.length]
    };
    setState(prev => ({ ...prev, categories: [...prev.categories, newCategory] }));
  };

  const deleteCategory = (id: string) => {
    triggerConfirm(
      'Apagar Categoria',
      'As despesas associadas perderão a categoria, mas não serão apagadas.',
      () => {
        setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
        setConfirmDialog(p => ({ ...p, isOpen: false }));
      },
      'danger'
    );
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-24 shadow-2xl text-slate-900 border-x border-slate-200">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b px-6 py-5 sticky top-0 z-30 flex justify-between items-center">
        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
          DuoBalance
        </h1>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase">Ricardo & Rafaela</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        {view === 'main' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Card de Resumo Atual */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest opacity-80">Saldo Atual</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <h2 className="text-4xl font-black">{(totals.ricardoTotal + totals.rafaelaTotal).toFixed(2)}€</h2>
                  <span className="text-indigo-200 text-sm font-medium">em aberto</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/20">
                  <div>
                    <p className="text-[10px] text-indigo-200 uppercase font-black">Ricardo pagou</p>
                    <p className="text-xl font-bold">{totals.ricardoTotal.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-200 uppercase font-black">Rafaela pagou</p>
                    <p className="text-xl font-bold">{totals.rafaelaTotal.toFixed(2)}€</p>
                  </div>
                </div>

                {totals.whoOwes !== 'None' && (
                  <div className="mt-6 bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/20 flex items-center gap-3">
                    <ArrowRightLeft size={20} className="text-indigo-200" />
                    <p className="text-sm">
                      A <span className="font-extrabold">{totals.whoOwes}</span> deve transferir <span className="text-lg font-black">{totals.balance.toFixed(2)}€</span>
                    </p>
                  </div>
                )}

                {state.expenses.length > 0 && (
                  <button 
                    onClick={settleAccounts}
                    className="w-full mt-4 bg-white text-indigo-700 py-3.5 rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    FECHAR CONTAS
                  </button>
                )}
              </div>
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            {/* Lista de Despesas */}
            <div className="space-y-4">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider px-1">
                <Wallet size={16} className="text-indigo-600" />
                Despesas do Período
              </h3>

              {state.expenses.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">Sem despesas registadas.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {state.expenses.map((expense) => {
                    const category = state.categories.find(c => c.id === expense.categoryId);
                    return (
                      <div key={expense.id} className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black ${expense.payer === 'Ricardo' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                            {expense.payer[0]}
                          </div>
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-slate-800">{expense.amount.toFixed(2)}€</p>
                              {category && (
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${category.color}`}>
                                  {category.name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium truncate max-w-[140px]">{expense.description || 'Sem nota'}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase">{new Date(expense.date).toLocaleDateString('pt-PT')}</p>
                          </div>
                        </div>
                        <button onClick={() => deleteExpense(expense.id)} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-4 animate-in slide-in-from-right duration-300">
            <h2 className="text-xl font-black text-slate-800 px-1 uppercase tracking-tight">Histórico de Fechos</h2>
            {state.batches.length === 0 ? (
              <div className="text-center py-20 text-slate-400">Ainda não há períodos fechados.</div>
            ) : (
              state.batches.map(batch => (
                <div key={batch.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{batch.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Liquidado em {new Date(batch.settledAt).toLocaleDateString('pt-PT')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedBatchExpenses(batch)} 
                        className="p-2 text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
                        title="Ver Despesas"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => revertBatch(batch.id)} 
                        className="p-2 text-amber-600 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors"
                        title="Reverter Fecho"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Ricardo</p>
                      <p className="font-black text-slate-800 text-lg">{batch.totalRicardo.toFixed(2)}€</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Rafaela</p>
                      <p className="font-black text-slate-800 text-lg">{batch.totalRafaela.toFixed(2)}€</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">Resolução final:</span>
                    <span className="font-black text-indigo-700">
                      {batch.payerWhoOwes === 'None' ? 'Contas certas' : `${batch.payerWhoOwes} pagou ${batch.balance.toFixed(2)}€`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'stats' && (
          <div className="space-y-8 animate-in slide-in-from-left duration-300 pb-10">
            <h2 className="text-xl font-black text-slate-800 px-1 uppercase tracking-tight">Estatísticas</h2>
            
            {/* SEÇÃO 1: ANALISE POR FECHO */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                <CalendarDays size={14} /> Estatísticas por Período
              </h3>
              
              <div className="space-y-4">
                {/* Período Atual */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black text-slate-800">Período Atual (Aberto)</h4>
                    <span className="text-xs font-black text-indigo-600">{stats.currentPeriodStats.total.toFixed(2)}€</span>
                  </div>
                  
                  {/* Payer Split for this batch */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
                      <span className="text-blue-600">RIC: {stats.currentPeriodStats.ricardo.toFixed(0)}€</span>
                      <span className="text-pink-600">RAF: {stats.currentPeriodStats.rafaela.toFixed(0)}€</span>
                    </div>
                    <div className="h-2 bg-slate-50 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500" style={{ width: `${(stats.currentPeriodStats.ricardo / (stats.currentPeriodStats.total || 1)) * 100}%` }}></div>
                      <div className="h-full bg-pink-500" style={{ width: `${(stats.currentPeriodStats.rafaela / (stats.currentPeriodStats.total || 1)) * 100}%` }}></div>
                    </div>
                  </div>

                  {stats.currentPeriodStats.categories.length > 0 ? (
                    <div className="space-y-3 pt-2">
                      {stats.currentPeriodStats.categories.map((cat) => (
                        <div key={cat.id} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                            <span>{cat.name}</span>
                            <span>{cat.total.toFixed(2)}€</span>
                          </div>
                          <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(cat.total / (stats.currentPeriodStats.total || 1)) * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-[10px] text-slate-300 py-4 font-bold uppercase italic">Sem despesas ativas</p>
                  )}
                </div>

                {/* Fechos Anteriores */}
                {stats.batchStats.map((batch) => (
                  <div key={batch.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4 border-l-4 border-l-slate-200">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-black text-slate-800">{batch.name}</h4>
                      <span className="text-xs font-black text-slate-500">{batch.total.toFixed(2)}€</span>
                    </div>
                    
                    {/* Payer Split for this batch */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
                        <span className="text-blue-600">RIC: {batch.ricardo.toFixed(0)}€</span>
                        <span className="text-pink-600">RAF: {batch.rafaela.toFixed(0)}€</span>
                      </div>
                      <div className="h-2 bg-slate-50 rounded-full overflow-hidden flex">
                        <div className="h-full bg-blue-400" style={{ width: `${(batch.ricardo / (batch.total || 1)) * 100}%` }}></div>
                        <div className="h-full bg-pink-400" style={{ width: `${(batch.rafaela / (batch.total || 1)) * 100}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {batch.categories.map((cat) => (
                        <div key={cat.id} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                            <span>{cat.name}</span>
                            <span>{cat.total.toFixed(2)}€</span>
                          </div>
                          <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(cat.total / (batch.total || 1)) * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SEÇÃO 2: ANALISE GERAL / VITALÍCIA */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                <TrendingUp size={14} /> Resumo Geral Vitalício
              </h3>
              
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8">
                {/* Comparativo de Gastos Totais */}
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-black uppercase tracking-widest px-1">
                    <span className="text-blue-600">Ricardo ({stats.ricardoAllTime.toFixed(0)}€)</span>
                    <span className="text-pink-600">Rafaela ({stats.rafaelaAllTime.toFixed(0)}€)</span>
                  </div>
                  <div className="h-5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-1000 ease-out"
                      style={{ width: `${(stats.ricardoAllTime / (stats.totalAllTime || 1)) * 100}%` }}
                    ></div>
                    <div 
                      className="h-full bg-pink-500 transition-all duration-1000 ease-out"
                      style={{ width: `${(stats.rafaelaAllTime / (stats.totalAllTime || 1)) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-center pt-2">
                    <p className="text-4xl font-black text-slate-800 tracking-tighter">{stats.totalAllTime.toFixed(2)}€</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Acumulado</p>
                  </div>
                </div>

                {/* Top Categorias Históricas */}
                <div className="space-y-5 pt-4 border-t border-slate-50">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Categorias (Histórico Completo)</h4>
                   <div className="space-y-4">
                    {stats.globalCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${cat.color.split(' ')[0]}`}>
                          {cat.name[0]}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[11px] font-black uppercase text-slate-700">
                            <span>{cat.name}</span>
                            <span>{cat.total.toFixed(2)}€</span>
                          </div>
                          <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(cat.total / (stats.totalAllTime || 1)) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {stats.totalAllTime === 0 && (
                      <p className="text-center text-xs text-slate-300 py-4 font-bold uppercase italic">Sem dados históricos ainda</p>
                    )}
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-black text-slate-800 px-1 uppercase tracking-tight">Ajustes</h2>
            
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Gerir Categorias</h3>
              <div className="flex flex-wrap gap-2">
                {state.categories.map(cat => (
                  <div key={cat.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm ${cat.color}`}>
                    {cat.name}
                    <button onClick={() => deleteCategory(cat.id)} className="hover:scale-110 transition-transform"><X size={12} /></button>
                  </div>
                ))}
              </div>
              <form 
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('catName') as HTMLInputElement;
                  if (input.value.trim()) {
                    addCategory(input.value.trim());
                    input.value = '';
                  }
                }}
              >
                <input name="catName" placeholder="Nova categoria..." className="flex-1 px-4 py-3 text-sm bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium" />
                <button type="submit" className="bg-indigo-600 text-white p-3 rounded-2xl"><Plus size={20} /></button>
              </form>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-red-50 space-y-4">
              <h3 className="text-xs font-black text-red-500 uppercase tracking-widest">Manutenção</h3>
              <button 
                onClick={() => {
                  triggerConfirm(
                    'RESETE TOTAL',
                    'Atenção: Irá apagar TODAS as despesas e histórico. Esta ação é irreversível!',
                    () => {
                      setState(INITIAL_STATE);
                      setView('main');
                      setConfirmDialog(p => ({ ...p, isOpen: false }));
                    },
                    'danger'
                  );
                }}
                className="w-full flex items-center justify-center gap-2 text-sm text-red-600 font-black bg-red-50 py-4 rounded-2xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
              >
                <AlertCircle size={18} />
                LIMPAR TODOS OS DADOS
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Navegação Inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 flex justify-around items-center px-6 py-4 z-40 max-w-md mx-auto shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        <button onClick={() => setView('main')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'main' ? 'text-indigo-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
          <Home size={22} strokeWidth={view === 'main' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Início</span>
        </button>
        <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'history' ? 'text-indigo-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
          <History size={22} strokeWidth={view === 'history' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Fechos</span>
        </button>
        
        <div className="relative -top-10">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-full shadow-[0_10px_20px_rgba(79,70,229,0.3)] flex items-center justify-center active:scale-90 transition-transform border-4 border-slate-50"
          >
            <Plus size={32} strokeWidth={3} />
          </button>
        </div>

        <button onClick={() => setView('stats')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'stats' ? 'text-indigo-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
          <BarChart3 size={22} strokeWidth={view === 'stats' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Stats</span>
        </button>
        <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'settings' ? 'text-indigo-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
          <SettingsIcon size={22} strokeWidth={view === 'settings' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Ajustes</span>
        </button>
      </nav>

      {/* Diálogo de Confirmação Customizado */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-sm:max-w-xs max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
              confirmDialog.type === 'danger' ? 'bg-red-50 text-red-500' :
              confirmDialog.type === 'warning' ? 'bg-amber-50 text-amber-500' :
              'bg-blue-50 text-blue-500'
            }`}>
              {confirmDialog.type === 'danger' ? <Trash2 size={32} /> :
               confirmDialog.type === 'warning' ? <AlertTriangle size={32} /> :
               <AlertCircle size={32} />}
            </div>
            
            <h3 className="text-xl font-black text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
              {confirmDialog.message}
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDialog.onConfirm}
                className={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg ${
                  confirmDialog.type === 'danger' ? 'bg-red-600 text-white shadow-red-100 hover:bg-red-700' :
                  confirmDialog.type === 'warning' ? 'bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600' :
                  'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                }`}
              >
                CONFIRMAR
              </button>
              <button 
                onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
                className="w-full py-4 rounded-2xl font-black text-sm text-slate-400 hover:bg-slate-50 transition-colors"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Despesas do Fecho */}
      {selectedBatchExpenses && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="px-8 py-6 flex justify-between items-center border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">{selectedBatchExpenses.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lista de Despesas Arquivadas</p>
              </div>
              <button onClick={() => setSelectedBatchExpenses(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {selectedBatchExpenses.expenses.map((expense) => {
                const category = state.categories.find(c => c.id === expense.categoryId);
                return (
                  <div key={expense.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${expense.payer === 'Ricardo' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                      {expense.payer[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{expense.amount.toFixed(2)}€</p>
                        {category && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter ${category.color}`}>
                            {category.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium truncate">{expense.description || 'Sem nota'}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(expense.date).toLocaleDateString('pt-PT')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
              <button 
                onClick={() => setSelectedBatchExpenses(null)}
                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm hover:bg-slate-900 transition-colors"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Despesa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="px-8 py-6 flex justify-between items-center border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Nova Despesa</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            <form 
              className="p-8 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addExpense({
                  amount: parseFloat(formData.get('amount') as string),
                  payer: formData.get('payer') as Payer,
                  date: new Date().toISOString(),
                  categoryId: formData.get('categoryId') as string,
                  description: formData.get('description') as string,
                });
              }}
            >
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor (€)</label>
                <input 
                  name="amount" 
                  type="number" 
                  step="0.01" 
                  required 
                  autoFocus
                  placeholder="0.00"
                  className="w-full text-5xl font-black bg-transparent border-none focus:ring-0 p-0 placeholder:text-slate-100 caret-indigo-600"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quem pagou?</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="cursor-pointer group">
                    <input type="radio" name="payer" value="Ricardo" className="hidden peer" defaultChecked />
                    <div className="p-5 text-center rounded-[1.5rem] border-2 border-slate-100 peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all group-active:scale-95">
                      <p className="font-black text-slate-700 uppercase text-xs tracking-wider">Ricardo</p>
                    </div>
                  </label>
                  <label className="cursor-pointer group">
                    <input type="radio" name="payer" value="Rafaela" className="hidden peer" />
                    <div className="p-5 text-center rounded-[1.5rem] border-2 border-slate-100 peer-checked:border-pink-500 peer-checked:bg-pink-50 transition-all group-active:scale-95">
                      <p className="font-black text-slate-700 uppercase text-xs tracking-wider">Rafaela</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</label>
                <select name="categoryId" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none">
                  {state.categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                <input name="description" placeholder="Opcional..." className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>

              <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all tracking-tight">
                ADICIONAR
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
