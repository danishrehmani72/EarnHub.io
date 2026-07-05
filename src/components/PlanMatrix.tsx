import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlan } from '../types';
import { ShieldCheck, CheckCircle2, TrendingUp, XCircle, ArrowRight, Lock } from 'lucide-react';

interface PlanMatrixProps {
  balance: number;
  investments: UserPlan[];
  onCreatePlan: (planId: string, amount: number) => Promise<void>;
  onCancelPlan: (invId: string) => Promise<void>;
  currencySymbol: string;
  conversionRate: number;
  theme?: 'light' | 'dark';
}

const PLANS = [
  { id: 'bronze', name: 'Starter Portfolio', min: 100, max: 999.99, targetPercent: 8, color: 'text-emerald-500', border: 'border-emerald-500/30' },
  { id: 'silver', name: 'Growth Portfolio', min: 1000, max: 4999.99, targetPercent: 12, color: 'text-indigo-400', border: 'border-indigo-400/30' },
  { id: 'gold', name: 'Pro Portfolio', min: 5000, max: 24999.99, targetPercent: 18, color: 'text-purple-400', border: 'border-purple-400/50' },
  { id: 'diamond', name: 'Elite Portfolio', min: 25000, max: Infinity, targetPercent: 24, color: 'text-blue-400', border: 'border-blue-500/50' },
];

export function PlanMatrix({ balance, investments, onCreatePlan, onCancelPlan, currencySymbol, conversionRate, theme = 'light' }: PlanMatrixProps) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const activePlans = investments.filter(inv => inv.status === 'active');
  const completedPlans = investments.filter(inv => inv.status === 'completed');

  const handleActivate = async () => {
    setError('');
    const amt = parseFloat(depositAmount) / conversionRate;
    
    if (isNaN(amt) || amt < selectedPlan.min) {
      setError(`Minimum deposit for ${selectedPlan.name} is ${currencySymbol}${(selectedPlan.min * conversionRate).toFixed(2)}`);
      return;
    }
    if (selectedPlan.max !== Infinity && amt > selectedPlan.max) {
      setError(`Maximum deposit for ${selectedPlan.name} is ${currencySymbol}${(selectedPlan.max * conversionRate).toFixed(2)}`);
      return;
    }
    if (amt > balance) {
      setError(`Insufficient wallet balance. Please add funds.`);
      return;
    }
    
    setIsLoading(true);
    await onCreatePlan(selectedPlan.id, amt);
    setIsLoading(false);
    setSelectedPlan(null);
    setDepositAmount('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANS.map(plan => {
          const hasActive = activePlans.some(inv => inv.planId === plan.id);
          
          return (
            <div 
              key={plan.id} 
              className={`rounded-2xl border ${plan.border} p-5 relative overflow-hidden flex flex-col justify-between transition-all duration-500 cursor-pointer group hover:scale-[1.03] hover:-translate-y-1 shadow-[0_8px_32px_rgba(0,0,0,0.04)] ${
                theme === 'dark' 
                  ? 'bg-[#131B2E]/65 backdrop-blur-md text-white hover:shadow-[0_12px_40px_rgba(59,130,246,0.15)] hover:border-blue-500/50' 
                  : 'bg-white/70 backdrop-blur-md text-slate-800 hover:shadow-[0_12px_40px_rgba(16,185,129,0.08)] hover:border-emerald-500/35'
              }`} 
              onClick={() => setSelectedPlan(plan)}
            >
               <div className="space-y-2 relative z-10 mb-4">
                 <h4 className={`text-xl font-bold font-serif ${plan.color}`}>{plan.name} Plan</h4>
                 <div className={`flex flex-col gap-1.5 mt-2 text-sm ${theme === 'dark' ? 'text-white/80' : 'text-slate-600'}`}>
                    <p><span className={`${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-mono text-[10px] uppercase tracking-wider`}>Deposit:</span> <strong className="font-sans">{currencySymbol}{(plan.min * conversionRate).toFixed(0)} {plan.max === Infinity ? '+' : `- ${currencySymbol}${(plan.max * conversionRate).toFixed(0)}`}</strong></p>
                    <p><span className={`${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-mono text-[10px] uppercase tracking-wider`}>Daily Profit:</span> <strong className="font-sans text-emerald-500">Dynamic (Varies)</strong></p>
                    <p><span className={`${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} font-mono text-[10px] uppercase tracking-wider`}>Completion:</span> <strong className={`font-sans ${theme === 'dark' ? 'text-white/90' : 'text-slate-800'}`}>{plan.targetPercent}% Return OR 30 Days</strong></p>
                 </div>
               </div>
               
               <div className="relative z-10 w-full mt-2">
                  <button className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all cursor-pointer border-0 ${hasActive ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shadow-sm font-extrabold' : `${theme === 'dark' ? 'bg-white/5 text-white/60' : 'bg-gray-100 text-slate-700'} hover:bg-emerald-500 hover:text-white`}`}>
                     {hasActive ? 'Plan Active' : 'Activate Plan'}
                  </button>
               </div>
               
               <div className={`absolute -right-8 -bottom-8 opacity-[0.03] ${plan.color}`}>
                  <ShieldCheck className="w-32 h-32" />
               </div>
            </div>
          );
        })}
      </div>

      {activePlans.length > 0 && (
        <div className={`rounded-2xl p-5 mt-8 border ${theme === 'dark' ? 'bg-[#131B2E] border-white/5' : 'bg-white border-gray-150 shadow-sm'}`}>
           <h3 className={`text-[11px] font-bold uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>Active Locked Portfolios</h3>
           <div className="space-y-3">
             {activePlans.map(inv => {
               const planInfo = PLANS.find(p => p.id === inv.planId);
               const nowTime = Date.now();
               const startTime = inv.createdAt?.seconds 
                 ? inv.createdAt.seconds * 1000 
                 : new Date(inv.timestamp).getTime() || nowTime;
               
               const elapsedMs = nowTime - startTime;
               const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
               const isLocked = elapsedMs < thirtyDaysMs;
               const remainingDays = isLocked ? Math.ceil((thirtyDaysMs - elapsedMs) / (24 * 60 * 60 * 1000)) : 0;

               return (
                 <div key={inv.id} className={`flex flex-col sm:flex-row justify-between sm:items-center rounded-xl p-4 gap-4 border ${theme === 'dark' ? 'bg-slate-950/40 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                   <div>
                     <p className={`text-sm font-bold capitalize ${planInfo?.color || 'text-white'}`}>{inv.planId} Package</p>
                     <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Principal Locked: {currencySymbol}{(inv.amount * conversionRate).toFixed(2)}</p>
                   </div>
                   <div className="flex items-center gap-4">
                     <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] uppercase font-bold tracking-wider rounded border border-emerald-500/20">Dynamic Profit Accruing</span>
                     {true ? (
                       <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded select-none cursor-default" title="This plan is locked. Accrued profits automatically transfer upon completion.">
                         <Lock className="w-3 h-3 text-amber-500 animate-pulse" />
                         <span>Locked ({remainingDays}d / Max 30d)</span>
                       </div>
                     ) : (
                       <button onClick={() => onCancelPlan(inv.id)} className="px-3 py-1.5 text-[10px] uppercase font-bold text-rose-400 tracking-wider bg-rose-500/10 border border-rose-500/20 rounded hover:bg-rose-500/20 transition-all border-0 cursor-pointer">Cancel Plan</button>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      )}

      {completedPlans.length > 0 && (
        <div className={`rounded-2xl p-5 mt-8 border ${theme === 'dark' ? 'bg-[#131B2E] border-emerald-500/10' : 'bg-white border-emerald-500/10 shadow-sm'}`}>
            <h3 className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest mb-4">Completed (Matured) Portfolios</h3>
            <div className="space-y-3">
              {completedPlans.map(inv => {
                const planInfo = PLANS.find(p => p.id === inv.planId);
                return (
                  <div key={inv.id} className={`flex flex-col sm:flex-row justify-between sm:items-center rounded-xl p-4 gap-4 border ${theme === 'dark' ? 'bg-slate-950/40 border-emerald-500/10' : 'bg-gray-50 border-emerald-500/10'}`}>
                    <div>
                      <p className={`text-sm font-bold capitalize ${planInfo?.color || 'text-white'}`}>{inv.planId} Package</p>
                      <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Matured Return: {currencySymbol}{(inv.amount * (planInfo ? 1 + (planInfo.targetPercent / 100) : 1.20) * conversionRate).toFixed(2)} (Principal & Yield Credited)</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded select-none cursor-default">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Matured</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      )}

      {/* Deposit Modal / Plan Setup Modal */}
      {selectedPlan && (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm p-4 ${theme === 'dark' ? 'bg-slate-950/80' : 'bg-slate-900/60'}`}>
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.9 }}
             className={`w-full max-w-md rounded-2xl shadow-2xl p-6 border ${theme === 'dark' ? 'bg-[#131B2E] border-white/10 text-white' : 'bg-white border-gray-200 text-slate-800'}`}
           >
              <div className="flex justify-between items-center mb-6">
                 <div>
                   <h2 className={`text-xl font-bold font-serif ${selectedPlan.color}`}>Activate {selectedPlan.name}</h2>
                   <p className={`text-xs mt-1 uppercase tracking-wider ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Estimated APY: {selectedPlan.targetPercent}%</p>
                 </div>
                 <button onClick={() => { setSelectedPlan(null); setError(''); }} className={`p-2 rounded-full cursor-pointer border-0 ${theme === 'dark' ? 'bg-white/5 text-white/50 hover:text-white' : 'bg-gray-100 text-slate-400 hover:text-slate-600'}`}>
                   <XCircle className="w-5 h-5" />
                 </button>
              </div>

              <div className="space-y-4">
                 <div className={`border rounded-xl p-4 flex justify-between items-center text-sm font-sans ${theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                   <span className={theme === 'dark' ? 'text-white/50' : 'text-slate-500'}>Available Wallet</span>
                   <span className={`font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{currencySymbol}{(balance * conversionRate).toFixed(2)}</span>
                 </div>
                 
                 <div className="space-y-2 text-left">
                   <label className={`text-[11px] font-bold tracking-widest uppercase ml-1 ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>Investment Amount ({currencySymbol.trim()})</label>
                   <input 
                      type="number" 
                      value={depositAmount} 
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder={`Min ${selectedPlan.min * conversionRate}`}
                      className={`w-full border rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 font-mono ${theme === 'dark' ? 'bg-[#161616] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-slate-800'}`}
                   />
                 </div>

                 {error && (
                   <p className="text-xs text-rose-500 font-semibold px-1 text-left">{error}</p>
                 )}

                 <p className={`text-[10px] leading-relaxed px-1 text-left ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>
                   Note: The investment principal will be locked to generate yields. The portfolio automatically matures once the Estimated Yield of {selectedPlan.targetPercent}% is reached, or after a maximum of 30 days. No manual cancellation or auto-renewal is permitted. 
                   Once completed, your matured principal and profit will be credited to your Matured Balance, ready for reinvestment or withdrawal.
                 </p>

                 <button 
                   onClick={handleActivate}
                   disabled={isLoading || !depositAmount}
                   className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2 border-0 cursor-pointer shadow-lg"
                 >
                   {isLoading ? 'Processing...' : 'Confirm Activation'} <ArrowRight className="w-4 h-4" />
                 </button>
              </div>
           </motion.div>
        </div>
      )}
    </motion.div>
  );
}
