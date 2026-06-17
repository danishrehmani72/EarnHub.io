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
}

const PLANS = [
  { id: 'bronze', name: 'Bronze', min: 5, max: 14.99, dailyProfit: 3, color: 'text-amber-600', border: 'border-amber-600/30' },
  { id: 'silver', name: 'Silver', min: 15, max: 49.99, dailyProfit: 4, color: 'text-slate-400', border: 'border-slate-400/30' },
  { id: 'gold', name: 'Gold', min: 50, max: 99.99, dailyProfit: 5, color: 'text-yellow-400', border: 'border-yellow-400/50' },
  { id: 'diamond', name: 'Diamond', min: 100, max: Infinity, dailyProfit: 7, color: 'text-[#D4AF37]', border: 'border-[#D4AF37]/50' },
];

export function PlanMatrix({ balance, investments, onCreatePlan, onCancelPlan, currencySymbol, conversionRate }: PlanMatrixProps) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const activePlans = investments.filter(inv => inv.status === 'active');

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
            <div key={plan.id} className={`bg-[#0A0A0A] rounded-2xl border ${plan.border} p-5 relative overflow-hidden flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:border-[#D4AF37]/60 group`} onClick={() => setSelectedPlan(plan)}>
               <div className="space-y-2 relative z-10 mb-4">
                 <h4 className={`text-xl font-bold font-serif ${plan.color}`}>{plan.name} Plan</h4>
                 <div className="flex flex-col gap-1.5 mt-2 text-white/80 text-sm">
                    <p><span className="text-white/40 font-mono text-[10px] uppercase tracking-wider">Deposit:</span> <strong className="font-sans">{currencySymbol}{(plan.min * conversionRate).toFixed(0)} {plan.max === Infinity ? '+' : `- ${currencySymbol}${(plan.max * conversionRate).toFixed(0)}`}</strong></p>
                    <p><span className="text-white/40 font-mono text-[10px] uppercase tracking-wider">Daily Profit:</span> <strong className="font-sans text-emerald-400">{plan.dailyProfit}%</strong></p>
                    <p><span className="text-white/40 font-mono text-[10px] uppercase tracking-wider">Duration:</span> <strong className="font-sans text-white/90">30-Day Lock / Cancel After</strong></p>
                 </div>
               </div>
               
               <div className="relative z-10 w-full mt-2">
                  <button className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${hasActive ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'bg-[#1A1A1A] text-white/60 group-hover:bg-[#D4AF37] group-hover:text-black group-hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] border border-white/5 group-hover:border-[#D4AF37]'}`}>
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
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 mt-8">
           <h3 className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-4">Active Investment Portfolios</h3>
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
                 <div key={inv.id} className="flex flex-col sm:flex-row justify-between sm:items-center bg-black/40 border border-white/5 rounded-xl p-4 gap-4">
                   <div>
                     <p className={`text-sm font-bold capitalize ${planInfo?.color || 'text-white'}`}>{inv.planId} Package</p>
                     <p className="text-xs text-white/40 mt-0.5">Principal Locked: {currencySymbol}{(inv.amount * conversionRate).toFixed(2)}</p>
                   </div>
                   <div className="flex items-center gap-4">
                     <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold tracking-wider rounded border border-emerald-500/20">Earning {planInfo?.dailyProfit}%</span>
                     {isLocked ? (
                       <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded select-none cursor-default" title="This plan is locked for the first 30 days of active investment.">
                         <Lock className="w-3 h-3 text-amber-500 animate-pulse" />
                         <span>Locked ({remainingDays}d left)</span>
                       </div>
                     ) : (
                       <button onClick={() => onCancelPlan(inv.id)} className="px-3 py-1.5 text-[10px] uppercase font-bold text-rose-400 tracking-wider bg-rose-500/10 border border-rose-500/20 rounded hover:bg-rose-500/20 transition-all">Cancel Plan</button>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      )}

      {/* Deposit Modal / Plan Setup Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.9 }}
             className="w-full max-w-md bg-[#0C0C0C] border border-white/10 rounded-2xl shadow-2xl p-6"
           >
              <div className="flex justify-between items-center mb-6">
                 <div>
                   <h2 className={`text-xl font-bold font-serif ${selectedPlan.color}`}>Activate {selectedPlan.name}</h2>
                   <p className="text-xs text-white/40 mt-1 uppercase tracking-wider">Earn {selectedPlan.dailyProfit}% daily profit</p>
                 </div>
                 <button onClick={() => { setSelectedPlan(null); setError(''); }} className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white">
                   <XCircle className="w-5 h-5" />
                 </button>
              </div>

              <div className="space-y-4">
                 <div className="bg-black/50 border border-white/5 rounded-xl p-4 flex justify-between items-center text-sm font-sans">
                   <span className="text-white/50">Available Wallet</span>
                   <span className="font-mono text-white">{currencySymbol}{(balance * conversionRate).toFixed(2)}</span>
                 </div>
                 
                 <div className="space-y-2">
                   <label className="text-[11px] font-bold text-white/50 tracking-widest uppercase ml-1">Investment Amount ({currencySymbol.trim()})</label>
                   <input 
                      type="number" 
                      value={depositAmount} 
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder={`Min ${selectedPlan.min * conversionRate}`}
                      className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#D4AF37]/50 text-white font-mono"
                   />
                 </div>

                 {error && (
                   <p className="text-xs text-rose-400 font-medium px-1">{error}</p>
                 )}

                 <p className="text-[10px] text-white/30 leading-relaxed px-1">
                   Note: The investment principal will be locked to generate daily yields. 
                   You can withdraw profits at any time. Cancelling the plan is available exactly 30 days after activation, which returns your principal to your wallet and stops future daily earnings.
                 </p>

                 <button 
                   onClick={handleActivate}
                   disabled={isLoading || !depositAmount}
                   className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
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
