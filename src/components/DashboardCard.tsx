/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Copy, 
  Check, 
  TrendingUp, 
  User, 
  Award, 
  DollarSign, 
  Users,
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  Wallet, 
  Coins, 
  Layers,
  LogOut,
  HelpCircle,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { FaqSection } from './FaqSection';
import { ReferralLog, DepositLog, WithdrawalLog } from '../types';
import { AvatarIcon, getAvatarConfig } from '../lib/avatars';

interface DashboardCardProps {
  name: string;
  userId: string;
  balance: number;
  referralCount: number;
  logs: ReferralLog[];
  avatar?: string;
  deposits?: DepositLog[];
  withdrawals?: WithdrawalLog[];
  onCreateDeposit?: (amount: number, network: string, txHash: string) => Promise<void>;
  onCreateWithdrawal?: (amount: number, network: string, wallet: string) => Promise<void>;
  onUpdateTxStatus?: (type: 'deposit' | 'withdrawal', txId: string, status: 'approved' | 'rejected') => Promise<void>;
  onSignOut?: () => Promise<void> | void;
  investmentProfits?: number;
  onAddToast: (message: string, type: 'success' | 'error', sound?: any) => void;
  userProfile?: any;
  onClaimDailyReward?: (amount: number) => Promise<void>;
  virtualDays?: number;
  activeTab?: 'overview' | 'funding' | 'faq';
  onActiveTabChange?: (tab: 'overview' | 'funding' | 'faq') => void;
}

export default function DashboardCard({
  name,
  userId,
  balance,
  referralCount,
  logs,
  avatar,
  deposits = [],
  withdrawals = [],
  onCreateDeposit,
  onCreateWithdrawal,
  onUpdateTxStatus,
  onSignOut,
  investmentProfits = 0,
  onAddToast,
  userProfile,
  onClaimDailyReward,
  virtualDays = 0,
  activeTab: activeTabProp,
  onActiveTabChange,
}: DashboardCardProps) {
  const [copied, setCopied] = useState(false);
  const [activeTabLocal, setActiveTabLocal] = useState<'overview' | 'funding' | 'faq'>('overview');
  
  const activeTab = activeTabProp !== undefined ? activeTabProp : activeTabLocal;
  const setActiveTab = onActiveTabChange !== undefined ? onActiveTabChange : setActiveTabLocal;
  const [adminModeType, setAdminModeType] = useState<'sandbox' | 'platform_global'>('platform_global');

  // Cooldown calculation for daily check-in claims
  const [claimCooldown, setClaimCooldown] = useState('');

type CurrencyCode = 'USD' | 'PKR' | 'AFN' | 'INR' | 'EUR' | 'GBP' | 'IDR' | 'OMR' | 'MYR' | 'PHP';

const SUPPORTED_CURRENCIES: Record<CurrencyCode, { symbol: string; rate: number }> = {
  USD: { symbol: '$', rate: 1 },
  PKR: { symbol: '₨ ', rate: 280 },
  AFN: { symbol: '؋', rate: 70 },
  INR: { symbol: '₹', rate: 83.5 },
  EUR: { symbol: '€', rate: 0.92 },
  GBP: { symbol: '£', rate: 0.78 },
  IDR: { symbol: 'Rp ', rate: 16200 },
  OMR: { symbol: 'OMR ', rate: 0.38 },
  MYR: { symbol: 'RM ', rate: 4.70 },
  PHP: { symbol: '₱', rate: 58.5 },
};

  // Currency conversion configuration (persistent via localStorage)
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('currency_preference') as CurrencyCode) || 'USD';
    }
    return 'USD';
  });

  const activeConf = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
  const conversionRate = activeConf.rate;
  const currencySymbol = activeConf.symbol;

  const currencyRef = useRef(currency);
  useEffect(() => {
    currencyRef.current = currency;
  }, [currency]);

  const changeCurrency = (curr: CurrencyCode) => {
    setCurrency(curr);
    if (typeof window !== 'undefined') {
      localStorage.setItem('currency_preference', curr);
    }
  };

  // Live balance counting animation using motion/react
  const motionBalance = useMotionValue(balance);
  const animatedBalanceDisplay = useTransform(motionBalance, (val) => {
    const activeConf = SUPPORTED_CURRENCIES[currencyRef.current] || SUPPORTED_CURRENCIES.USD;
    return (val * activeConf.rate).toFixed(2);
  });

  // Balance change visual flash effects
  const [flashType, setFlashType] = useState<'up' | 'down' | null>(null);
  const prevBalanceRef = useRef(balance);

  useEffect(() => {
    const prev = prevBalanceRef.current;
    if (balance > prev) {
      setFlashType('up');
      const timer = setTimeout(() => setFlashType(null), 1200);
      prevBalanceRef.current = balance;
      return () => clearTimeout(timer);
    } else if (balance < prev) {
      setFlashType('down');
      const timer = setTimeout(() => setFlashType(null), 1200);
      prevBalanceRef.current = balance;
      return () => clearTimeout(timer);
    }
    prevBalanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    const controls = animate(motionBalance, balance, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
    });
    return () => controls.stop();
  }, [balance, motionBalance]);

  useEffect(() => {
    if (!userProfile?.lastClaimedAt) {
      setClaimCooldown('');
      return;
    }
    const updateCountdown = () => {
      const lastTime = new Date(userProfile.lastClaimedAt).getTime();
      const elapsed = Date.now() - lastTime;
      const remaining = 24 * 60 * 60 * 1000 - elapsed;
      if (remaining <= 0) {
        setClaimCooldown('');
      } else {
        const h = Math.floor(remaining / (3600 * 1000));
        const m = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
        const s = Math.floor((remaining % (60 * 1000)) / 1000);
        setClaimCooldown(`${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [userProfile?.lastClaimedAt]);

  // Crypto deposit address database configuration
  const depositAddresses: Record<string, string> = {
    BNB: '0xae24126409d6a1913951dd4d78fbc09e6fc9638f',
    TRX: 'TGKF1TB8vykfbwm3JR2Gc3ZaypnnhfmqJY',
    MATIC: '0xae24126409d6a1913951dd4d78fbc09e6fc9638f'
  };

  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  // Form states
  const [depNetwork, setDepNetwork] = useState('BNB');
  const [depAmount, setDepAmount] = useState('');
  const [depTxHash, setDepTxHash] = useState('');
  const [depError, setDepError] = useState('');
  const [depSuccess, setDepSuccess] = useState('');

  const [withdrawNetwork, setWithdrawNetwork] = useState('BNB');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawWallet, setWithdrawWallet] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  const [submitting, setSubmitting] = useState(false);



  // Construct referral link using current origin or a beautiful fallback
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${userId}` 
    : `https://demo-earnhub.com/?ref=${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const handleCopyAddr = async (network: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddr(network);
      setTimeout(() => setCopiedAddr(null), 2500);
    } catch (err) {
      console.error('Failed to copy crypto address', err);
    }
  };

  // Submit deposit details proof
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepError('');
    setDepSuccess('');

    const amtInput = parseFloat(depAmount);
    if (!amtInput || amtInput <= 0) {
      setDepError('Please enter a valid positive deposit amount.');
      return;
    }
    const amtUSD = amtInput / conversionRate;
    if (!depTxHash.trim()) {
      setDepError('Please provide the transaction hash / TXHash for validation.');
      return;
    }

    setSubmitting(true);
    try {
      if (onCreateDeposit) {
        await onCreateDeposit(amtUSD, depNetwork, depTxHash.trim());
        setDepSuccess('Transaction Proof Submitted! Admin approval pending.');
        setDepAmount('');
        setDepTxHash('');
      } else {
        setDepError('Deposit system configuration issue. Please try again.');
      }
    } catch (err) {
      setDepError('Could not save transaction. Real-time Firebase error.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit withdrawal requests
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');

    const amtInput = parseFloat(withdrawAmount);
    if (!amtInput || amtInput <= 0) {
      setWithdrawError('Please enter a valid positive withdrawal amount.');
      return;
    }
    const amtUSD = amtInput / conversionRate;
    if (amtUSD < 10) {
      setWithdrawError(`Payout request amount too low. Transaction threshold not met (min $10.00 / ${currencySymbol}${(10 * conversionRate).toFixed(0)}).`);
      return;
    }
    if (amtUSD > balance) {
      setWithdrawError(`Insufficient funds. Your live balance is ${currencySymbol}${(balance * conversionRate).toFixed(2)}.`);
      return;
    }
    const isEasyPaisaOrJazzCash = withdrawNetwork === 'EASYPAISA' || withdrawNetwork === 'JAZZCASH';
    const minWalletLength = isEasyPaisaOrJazzCash ? 5 : 10;
    if (!withdrawWallet.trim() || withdrawWallet.trim().length < minWalletLength) {
      if (isEasyPaisaOrJazzCash) {
        setWithdrawError(`Please enter a valid ${withdrawNetwork === 'EASYPAISA' ? 'EasyPaisa' : 'JazzCash'} account number and title (at least 5 characters).`);
      } else {
        setWithdrawError('Please enter a valid destination crypto wallet address (at least 10 characters).');
      }
      return;
    }

    setSubmitting(true);
    try {
      if (onCreateWithdrawal) {
        await onCreateWithdrawal(amtUSD, withdrawNetwork, withdrawWallet.trim());
        setWithdrawSuccess('Withdrawal Request Saved! Admin approval pending.');
        setWithdrawAmount('');
        setWithdrawWallet('');
      } else {
        setWithdrawError('Withdrawal system configuration issues. Please try again.');
      }
    } catch (err) {
      setWithdrawError('Could not save withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveReject = async (type: 'deposit' | 'withdrawal', txId: string, status: 'approved' | 'rejected') => {
    try {
      if (onUpdateTxStatus) {
        await onUpdateTxStatus(type, txId, status);
      }
    } catch (e) {
      console.error('Could not modify transaction status', e);
    }
  };

  // --- Investment & Plan calculations ---
  const approvedDeposits = useMemo(() => {
    return (deposits || []).filter(d => d.status === 'approved');
  }, [deposits]);

  const totalApprovedDepositsSum = useMemo(() => {
    return approvedDeposits.reduce((sum, d) => sum + d.amount, 0);
  }, [approvedDeposits]);

  const hasActivePlan = approvedDeposits.some(d => d.amount >= 5);
  const activePlanStatus = hasActivePlan ? 'Active Plan' : 'Inactive Plan';

  // Calculate sum of daily performance percentages of all approved deposits
  const dailyProfitRate = useMemo(() => {
    return approvedDeposits.reduce((sum, dep) => {
      let percent = 0;
      if (dep.amount >= 100) percent = 7;
      else if (dep.amount >= 50) percent = 5;
      else if (dep.amount >= 15) percent = 4;
      else if (dep.amount >= 5) percent = 3;
      return sum + (dep.amount * (percent / 100));
    }, 0);
  }, [approvedDeposits]);

  const earliestApprovedDeposit = useMemo(() => {
    if (approvedDeposits.length === 0) return null;
    return [...approvedDeposits].sort((a, b) => {
      const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.timestamp).getTime() || 0;
      const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.timestamp).getTime() || 0;
      return aTime - bTime;
    })[0];
  }, [approvedDeposits]);

  const [timeRemaining, setTimeRemaining] = useState('24h 00m 00s');

  useEffect(() => {
    if (!earliestApprovedDeposit) {
      setTimeRemaining('--h --m --s');
      return;
    }

    const updateTimer = () => {
      const depTime = earliestApprovedDeposit.createdAt?.seconds 
        ? earliestApprovedDeposit.createdAt.seconds * 1000 
        : new Date(earliestApprovedDeposit.timestamp).getTime() || Date.now();
      
      const elapsedMs = Date.now() - depTime;
      const msInDay = 24 * 60 * 60 * 1000;
      const msPassedInCurrentCycle = elapsedMs % msInDay;
      const msRemaining = msInDay - msPassedInCurrentCycle;

      if (msRemaining <= 0) {
        setTimeRemaining('24h 00m 00s');
      } else {
        const hours = Math.floor(msRemaining / (60 * 60 * 1000));
        const minutes = Math.floor((msRemaining % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((msRemaining % (60 * 1000)) / 1000);
        
        const pad = (num: number) => String(num).padStart(2, '0');
        setTimeRemaining(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [earliestApprovedDeposit]);

  const nextMilestone = Math.ceil((balance + 1) / 100) * 100;
  const progressPercent = Math.min((balance / nextMilestone) * 100, 100);

  // Compute chronological progression for the Line Chart incorporating all approved ledger items
  const chartData = useMemo(() => {
    const events: { timestamp: number; dateStr: string; amount: number; label: string }[] = [];

    // 1. Referral earnings
    if (logs && logs.length > 0) {
      logs.forEach((log) => {
        const ts = log.createdAt?.seconds 
          ? log.createdAt.seconds * 1000 
          : new Date(log.timestamp).getTime() || 0;
        events.push({
          timestamp: ts,
          dateStr: log.timestamp,
          amount: log.amount !== undefined ? log.amount : 0.05,
          label: 'Referral Sign-up'
        });
      });
    }

    // 2. Approved Deposits & Investment Profits
    if (deposits && deposits.length > 0) {
      deposits
        .filter((d) => d.status === 'approved')
        .forEach((dep) => {
          const depTime = dep.createdAt?.seconds 
            ? dep.createdAt.seconds * 1000 
            : new Date(dep.timestamp).getTime() || 0;
          
          events.push({
            timestamp: depTime,
            dateStr: dep.timestamp,
            amount: dep.amount,
            label: 'Approved Deposit'
          });

          // Generate Daily Profit event payouts for this approved deposit
          const elapsedMs = Date.now() - depTime;
          const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
          const totalDays = elapsedDaysReal + virtualDays;

          let percent = 0;
          if (dep.amount >= 100) percent = 7;
          else if (dep.amount >= 50) percent = 5;
          else if (dep.amount >= 15) percent = 4;
          else if (dep.amount >= 5) percent = 3;

          const dailyRate = dep.amount * (percent / 100);

          if (dailyRate > 0) {
            for (let i = 1; i <= totalDays; i++) {
              const payoutTime = depTime + i * 24 * 60 * 60 * 1000;
              const payoutDate = new Date(payoutTime);
              events.push({
                timestamp: payoutTime,
                dateStr: payoutDate.toLocaleDateString(),
                amount: dailyRate,
                label: `Daily Return (+${dailyRate.toFixed(2)})`
              });
            }
          }
        });
    }

    // 3. Approved Withdrawals
    if (withdrawals && withdrawals.length > 0) {
      withdrawals
        .filter((w) => w.status === 'approved')
        .forEach((wit) => {
          const ts = wit.createdAt?.seconds 
            ? wit.createdAt.seconds * 1000 
            : new Date(wit.timestamp).getTime() || 0;
          events.push({
            timestamp: ts,
            dateStr: wit.timestamp,
            amount: -wit.amount,
            label: 'Approved Withdrawal'
          });
        });
    }

    const signupVal = userProfile?.signupBonus !== undefined ? userProfile.signupBonus : 0.10;

    if (events.length === 0) {
      return [
        { label: 'Start', balance: signupVal },
        { label: 'Today', balance: signupVal }
      ];
    }

    // Sort chronologically
    events.sort((a, b) => a.timestamp - b.timestamp);

    let runningSum = signupVal;
    const points = [{ label: 'Start', balance: signupVal }];

    events.forEach((evt, idx) => {
      runningSum += evt.amount;
      const date = new Date(evt.timestamp);
      const label = isNaN(date.getTime()) 
        ? `${evt.label.slice(0, 5)} #${idx + 1}`
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      points.push({
        label,
        balance: runningSum
      });
    });

    return points;
  }, [logs, deposits, withdrawals, virtualDays]);

  // Compute Referrals Data for the last 7 days for the new bar chart
  const referralChartData = useMemo(() => {
    const data: { day: string; earnings: number; fullDate: string }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        day: d.toLocaleDateString(undefined, { weekday: 'short' }),
        fullDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        earnings: 0
      });
    }

    if (logs && logs.length > 0) {
      logs.forEach((log) => {
        const amount = log.amount !== undefined ? log.amount : 0.05;
        const ts = log.createdAt?.seconds ? log.createdAt.seconds * 1000 : new Date(log.timestamp).getTime() || 0;
        
        const logDate = new Date(ts);
        const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        
        const diffDays = Math.floor((today.getTime() - logDay.getTime()) / (24 * 60 * 60 * 1000));
        
        if (diffDays >= 0 && diffDays < 7) {
          const index = 6 - diffDays;
          data[index].earnings += amount;
        }
      });
    }
    
    return data;
  }, [logs]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl bg-[#111111] rounded-3xl border border-white/5 shadow-2xl shadow-[#020202]/80 overflow-hidden text-[#E5E7EB]"
    >
      {/* Header with User summary */}
      <div 
        className="bg-[#0C0C0C] border-b border-white/5 p-6 md:p-8 relative overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(212, 175, 55, 0.05) 0%, rgba(0, 0, 0, 0) 70%), radial-gradient(circle at 30% 100%, rgba(138, 109, 59, 0.03) 0%, rgba(0, 0, 0, 0) 60%)'
        }}
      >

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.05)]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-white/40 font-semibold tracking-[0.25em] uppercase">Premium Member</p>
              <h2 className="text-xl font-bold font-serif text-white/95 flex items-center gap-2">
                {name} 
                <span className="text-[9px] font-sans font-medium tracking-widest bg-white/5 text-[#D4AF37] px-2 py-0.5 rounded border border-white/5 uppercase">
                  ID: {userId.slice(0, 8)}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {/* Currency Selector */}
            <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-2.5 h-8 text-[9px] font-extrabold select-none shadow-inner relative hover:border-[#D4AF37]/35 active:border-[#D4AF37]/50 transition-all text-white/80">
              <span className="text-[#D4AF37]">🌐</span>
              <select
                value={currency}
                onChange={(e) => changeCurrency(e.target.value as CurrencyCode)}
                className="bg-transparent border-none outline-none pr-2.5 py-1 text-white uppercase text-[9px] font-extrabold cursor-pointer appearance-none transition-all flex items-center justify-center leading-none"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                {Object.keys(SUPPORTED_CURRENCIES).map((code) => (
                  <option key={code} value={code} className="bg-[#111111] text-white/90 py-1 text-xs">
                    {code} ({SUPPORTED_CURRENCIES[code as CurrencyCode].symbol.trim()})
                  </option>
                ))}
              </select>
              <span className="text-white/30 text-[7px] pointer-events-none absolute right-2">▼</span>
            </div>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-all cursor-pointer flex items-center gap-1.5 bg-black/40 h-8"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 border-b border-white/5 bg-[#080808] p-1.5 rounded-2xl mx-4 sm:mx-6 md:mx-8 mt-5 gap-1.5">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2.5 px-2 sm:py-3 sm:px-3 rounded-xl text-[9px] xs:text-[10px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] transition-all duration-150 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20 shadow-md shadow-black/10'
              : 'text-white/40 hover:text-white/80 border border-transparent hover:bg-white/5'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 whitespace-nowrap shrink-0" />
          <span className="truncate">Overview</span>
        </button>
        
        <button
          onClick={() => setActiveTab('funding')}
          className={`py-2.5 px-2 sm:py-3 sm:px-3 rounded-xl text-[9px] xs:text-[10px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] transition-all duration-150 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            activeTab === 'funding'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20 shadow-md shadow-black/10'
              : 'text-white/40 hover:text-white/80 border border-transparent hover:bg-white/5'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 whitespace-nowrap shrink-0" />
          <span className="truncate">Funding</span>
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`py-2.5 px-2 sm:py-3 sm:px-3 rounded-xl text-[9px] xs:text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'faq'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20 shadow-md shadow-black/10'
              : 'text-white/40 hover:text-white/80 border border-transparent hover:bg-white/5'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 whitespace-nowrap shrink-0" />
          <span className="truncate">FAQ</span>
        </button>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Premium Passive Income Welcome Banner */}
              <div className="bg-gradient-to-r from-[#D4AF37]/15 via-[#8A6D3B]/5 to-transparent border border-[#D4AF37]/15 rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[#D4AF37]">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span className="text-[9px] uppercase font-bold tracking-[0.2em] font-sans">Automated Passive Yields</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white font-sans">
                    Earn money while you sleep with EarnHub Elite.
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed max-w-xl">
                    Your active deposits are secure in the tracking ledger. Sit back and watch your capital generate consistent yields automatically on autopilot, every 24 hours.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 font-mono">
                    Staking Matrix Live
                  </span>
                </div>
              </div>

              {/* Dynamic Cards: Balance, Investment, Timer, Referrals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Live Wallet Balance */}
                <div id="live-wallet-balance-card" className={`p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden shadow-inner border transition-all duration-500 ${
                  flashType === 'up'
                    ? 'border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.15)] scale-[1.01]'
                    : flashType === 'down'
                    ? 'border-rose-500/30 bg-rose-950/20 shadow-[0_0_25px_rgba(244,63,94,0.15)] scale-[0.99]'
                    : 'bg-[#161616] border-white/5'
                }`}>
                  <div className={`absolute -top-4 -right-4 pointer-events-none transition-colors duration-500 ${
                    flashType === 'up'
                      ? 'text-emerald-500/10'
                      : flashType === 'down'
                      ? 'text-rose-500/10'
                      : 'text-[#D4AF37]/5'
                  }`}>
                    <DollarSign className="w-20 h-20" />
                  </div>
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-bold font-sans">Wallet Balance</span>
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-all duration-300 ${
                      flashType === 'up'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : flashType === 'down'
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                        : 'bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#D4AF37]'
                    }`}>
                      <DollarSign className="w-3 h-3" />
                    </div>
                  </div>
                  <div className={`my-1 text-2xl font-serif tracking-tight z-10 flex items-baseline transition-all duration-300 ${
                    flashType === 'up'
                      ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : flashType === 'down'
                      ? 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                      : 'text-[#D4AF37]'
                  }`}>
                    {currencySymbol}<motion.span key={currency}>{animatedBalanceDisplay}</motion.span>
                  </div>
                  <div className={`text-[8.5px] font-medium flex items-center gap-1 z-10 leading-normal transition-all duration-300 ${
                    flashType === 'up'
                      ? 'text-emerald-300 animate-pulse'
                      : flashType === 'down'
                      ? 'text-rose-300 animate-pulse'
                      : 'text-emerald-400'
                  }`}>
                    <TrendingUp className="w-2.5 h-2.5 shrink-0" /> {
                      flashType === 'up'
                        ? 'Yield auto-ledger updated'
                        : flashType === 'down'
                        ? 'Funds debited successfully'
                        : 'Real-time active ledger'
                    }
                  </div>
                </div>

                {/* 2. Active Investment Package */}
                <div className={`border rounded-2xl p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden transition-all ${
                  hasActivePlan 
                    ? 'bg-[#161616] border-emerald-500/15' 
                    : 'bg-[#161616] border-white/5'
                }`}>
                  <div className="absolute -top-4 -right-4 text-emerald-500/5 pointer-events-none">
                    <Coins className="w-20 h-20" />
                  </div>
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-bold">Plan Statistics</span>
                    <span className={`text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                      hasActivePlan 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}>
                      {activePlanStatus}
                    </span>
                  </div>
                  <div className="my-1 font-serif text-white/90 text-2xl tracking-tight z-10 leading-none">
                    {currencySymbol}{(totalApprovedDepositsSum * conversionRate).toFixed(2)}
                    <span className="block text-[8.5px] font-sans text-white/30 tracking-widest uppercase font-semibold mt-1">
                      Active Deposit Plan
                    </span>
                  </div>
                  <div className="text-[8.5px] text-[#D4AF37] font-semibold flex items-center gap-1 z-10 leading-normal">
                    <Coins className="w-2.5 h-2.5 text-[#D4AF37] shrink-0" /> 
                    {hasActivePlan 
                      ? `Payout: +${currencySymbol}${(dailyProfitRate * conversionRate).toFixed(2)} / 24h` 
                      : `Requires min ${currencySymbol}${(5 * conversionRate).toFixed(0)} deposit`
                    }
                  </div>
                </div>

                {/* 3. Next Daily Payout Timer */}
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 text-white/5 pointer-events-none font-black text-6xl select-none">
                    T
                  </div>
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-bold">Payout Timer</span>
                    <div className="w-6 h-6 rounded bg-white/5 border border-white/10 text-white/60 flex items-center justify-center font-mono text-[9px]">
                      ⏱
                    </div>
                  </div>
                  <div className="my-1 font-mono text-white/95 text-xl font-bold tracking-wider z-10">
                    {timeRemaining}
                  </div>
                  <div className="text-[8.5px] text-white/40 font-medium flex items-center gap-1 z-10 leading-normal">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasActivePlan ? 'bg-emerald-400 animate-ping' : 'bg-white/20'}`} />
                    {hasActivePlan ? 'Fixed daily cycle running' : 'Await approved deposit'}
                  </div>
                </div>

                {/* 4. Total Referrals */}
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 text-white/5 pointer-events-none">
                    <Users className="w-20 h-20" />
                  </div>
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-bold">Total Referrals</span>
                    <div className="w-6 h-6 rounded bg-white/5 border border-white/10 text-white/60 flex items-center justify-center">
                      <Users className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="my-1 font-serif text-white/90 text-2xl tracking-tight z-10">
                    {referralCount}
                  </div>
                  <div className="text-[8.5px] text-[#D4AF37] font-medium flex items-center gap-1 z-10 leading-normal font-sans">
                    <Award className="w-2.5 h-2.5 text-[#D4AF37] shrink-0" /> Target progress: {progressPercent.toFixed(0)}%
                  </div>
                </div>

              </div>



              {/* Dynamic Earnings Growth Over Time Chart */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-sans">
                  <span className="font-semibold text-white/40">Earnings Progression Timeline</span>
                  <span className="font-bold text-[#D4AF37] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Growth Curve
                  </span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => `${currencySymbol.trim()}${(val * conversionRate).toFixed(0)}`}
                      />
                      <Tooltip 
                        cursor={{ stroke: 'rgba(212, 175, 55, 0.1)', strokeWidth: 1 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#161616] border border-white/10 p-2.5 rounded-lg shadow-xl font-sans">
                                <p className="text-white/40 font-semibold mb-1 uppercase tracking-widest text-[8px]">
                                  {payload[0].payload.label}
                                </p>
                                <p className="text-[#D4AF37] font-bold font-mono text-xs">
                                  Balance: {currencySymbol}{Number(Number(payload[0].value) * conversionRate).toFixed(2)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                        wrapperStyle={{ outline: 'none' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#D4AF37" 
                        strokeWidth={2}
                        dot={{ r: 3, stroke: '#111111', strokeWidth: 1, fill: '#D4AF37' }}
                        activeDot={{ r: 5, stroke: '#111111', strokeWidth: 1.5, fill: '#D4AF37' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 7-Day Referral Earnings Bar Chart */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-sans">
                  <span className="font-semibold text-white/40">7-Day Referral Distribution</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Referral Volume
                  </span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={referralChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => `${currencySymbol.trim()}${(val * conversionRate).toFixed(0)}`}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#161616] border border-white/10 p-2.5 rounded-lg shadow-xl font-sans">
                                <p className="text-white/40 font-semibold mb-1 uppercase tracking-widest text-[8px]">
                                  {payload[0].payload.fullDate}
                                </p>
                                <p className="text-emerald-400 font-bold font-mono text-xs">
                                  Referrals: {currencySymbol}{Number(Number(payload[0].value) * conversionRate).toFixed(2)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                        wrapperStyle={{ outline: 'none' }}
                      />
                      <Bar 
                        dataKey="earnings" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Milestone Gamification Progress */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-sans">
                  <span className="font-semibold text-white/40">Target Reward Milestone</span>
                  <span className={`font-bold transition-all duration-300 ${
                    flashType === 'up'
                      ? 'text-emerald-400'
                      : flashType === 'down'
                      ? 'text-rose-400'
                      : 'text-[#D4AF37]'
                  }`}>{currencySymbol}<motion.span key={currency}>{animatedBalanceDisplay}</motion.span> / {currencySymbol}{(nextMilestone * conversionRate).toFixed(2)}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      flashType === 'up'
                        ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        : flashType === 'down'
                        ? 'bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                        : 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.4)]'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] text-white/30 uppercase tracking-[0.15em] pt-0.5">
                  <span>Diamond tier progress</span>
                  <span>Next milestone at {currencySymbol}{(nextMilestone * conversionRate).toFixed(0)}</span>
                </div>
              </div>

              {/* Premium Daily Active Yield Claim Matrix */}
              <div className="bg-gradient-to-br from-[#1c1c16] to-[#121212] border border-[#D4AF37]/20 rounded-2xl p-5 relative overflow-hidden space-y-4">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[#D4AF37]">
                      <Sparkles className="w-4 h-4 text-[#D4AF37] animate-pulse" />
                      <span className="text-[9px] uppercase font-bold tracking-[0.2em] font-sans">Active Dividends Portal</span>
                    </div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Daily Staking Check-In Rewards
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed max-w-md">
                      Onboard daily to claim active mining yield boosts! Maintain your daily streak to access higher premium dividend tiers. (Streak: <strong className="text-[#D4AF37]">{userProfile?.claimStreak || 0} days</strong>)
                    </p>
                  </div>
                  
                  <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-lg py-1 px-3 text-right">
                    <span className="text-[8px] text-white/45 uppercase block">Total Dividends</span>
                    <span className="text-xs font-mono font-bold text-[#D4AF37]">+{currencySymbol}{((userProfile?.dailyBonusEarnings || 0) * conversionRate).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 justify-between pt-2 border-t border-white/[0.03]">
                  {/* Cooldown Timer */}
                  <div className="text-left flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${claimCooldown ? 'bg-[#D4AF37]/40' : 'bg-emerald-400 animate-ping'}`} />
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-white/30 block leading-none mb-1">Claim Status</span>
                      <span className="text-[11px] font-mono text-white/70">
                        {claimCooldown ? `Cooldown: ${claimCooldown}` : "Ready to disburse dividend!"}
                      </span>
                    </div>
                  </div>

                  {/* Claim Button */}
                  <button
                    disabled={!!claimCooldown}
                    onClick={async () => {
                      if (onClaimDailyReward) {
                        const currentStreak = userProfile?.claimStreak || 0;
                        const minAmt = currentStreak >= 5 ? 0.40 : 0.15;
                        const maxAmt = currentStreak >= 5 ? 0.60 : 0.35;
                        const claimAmt = Number((Math.random() * (maxAmt - minAmt) + minAmt).toFixed(2));
                        
                        await onClaimDailyReward(claimAmt);
                        onAddToast(`Daily dividends of ${currencySymbol}${(claimAmt * conversionRate).toFixed(2)} credited! Keep checking in daily! 🪙`, 'success', 'new_referral');
                      }
                    }}
                    className={`px-5 py-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-all duration-200 outline-none cursor-pointer w-full sm:w-auto ${
                      claimCooldown 
                        ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-[#D4AF37] to-[#B29430] hover:brightness-110 active:scale-[0.98] border-transparent text-black shadow-lg shadow-[#D4AF37]/10'
                    }`}
                  >
                    <span>{claimCooldown ? 'Claimed Today' : 'Claim Daily Yield'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Referral Link Copy Area */}
              <div className="space-y-3 pt-2">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                  Your Personal Direct Referral Link
                </label>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-[#D4AF37] font-mono tracking-wider overflow-x-auto whitespace-nowrap scrollbar-none flex items-center justify-between gap-3">
                    <span>{referralLink}</span>
                    <AnimatePresence>
                      {copied && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, x: 5 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.5, x: 5 }}
                          className="flex items-center gap-1 text-emerald-400 shrink-0 select-none pb-0.5"
                        >
                          <Check className="w-4 h-4 animate-bounce" />
                          <span className="text-[9px] font-black uppercase tracking-wider font-sans">Copied</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <button
                    onClick={handleCopy}
                    className={`px-5 py-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-all duration-200 outline-none cursor-pointer shrink-0 ${
                      copied 
                        ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white hover:border-white/20 active:scale-[0.98]'
                    }`}
                    title="Copy referral link to clipboard"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.div
                          key="checked"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>Copied!</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-1.5"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy Link</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>

                <div className="pt-1.5 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-semibold">Live Cloud Connection Active</span>
                  </div>
                  <span className="text-[9px] text-white/20 uppercase tracking-widest font-semibold">Onboard new partners in real-time</span>
                </div>
              </div>

              {/* Premium Customer Support & Fast Withdrawal Card */}
              <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 relative overflow-hidden mt-6 transition-all hover:border-sky-500/20">
                <div className="absolute top-0 right-0 p-3 text-sky-400/5 select-none pointer-events-none">
                  <HelpCircle className="w-16 h-16" />
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1.5 max-w-xl text-left">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[9px] uppercase font-bold tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                      Customer Support 24/7 Live
                    </span>
                    <h3 className="text-sm font-semibold text-white tracking-wide">
                      Need help or looking for fast withdrawals? 
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Our live response team processes your payouts and assists with account inquiries around the clock. Get dedicated support directly on Telegram 24/7 at <strong className="text-sky-400">@EarnHubSupportTeam</strong>.
                    </p>
                  </div>
                  <a
                    href="https://t.me/EarnHubSupportTeam"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-500 text-white font-bold text-xs uppercase tracking-wider hover:bg-sky-400 active:scale-[0.98] transition-all duration-150 shrink-0 shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20"
                  >
                    <span>Contact support 24/7</span>
                    <span className="font-mono text-[10px]">@EarnHubSupportTeam</span>
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'funding' && (
            <motion.div
              key="funding-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. DEPOSIT PORTAL */}
                <div id="deposit-section" className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4 scroll-mt-24">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">Deposit Crypto</h3>
                  </div>

                  <form onSubmit={handleDepositSubmit} className="space-y-3.5">
                    {/* Select Network */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-semibold text-white/40 uppercase tracking-widest">Select Network Token</label>
                      <select
                        value={depNetwork}
                        onChange={(e) => {
                          setDepNetwork(e.target.value);
                          setDepError('');
                          setDepSuccess('');
                        }}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl p-3 text-xs text-white uppercase font-semibold tracking-wider hover:border-white/20 transition-all outline-none"
                      >
                        <option value="BNB">BNB (BEP20)</option>
                        <option value="TRX">USDT TRON (TRC20)</option>
                        <option value="MATIC">Polygon (MATIC)</option>
                      </select>
                    </div>

                    {/* Display Transfer Address */}
                    <div className="space-y-1.5 bg-[#0C0C0C] border border-white/5 rounded-xl p-3.5 relative overflow-hidden">
                      <p className="text-[8px] font-bold text-[#D4AF37] uppercase tracking-widest mb-1.5">Official Safe Receiver Address</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-white/70 truncate tracking-wider">
                          {depositAddresses[depNetwork]}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyAddr(depNetwork, depositAddresses[depNetwork])}
                          className="px-2.5 py-1 text-[8px] tracking-wider uppercase font-bold text-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/25 rounded-md transition-all cursor-pointer"
                        >
                          {copiedAddr === depNetwork ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Amount Block */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-semibold text-white/40 uppercase tracking-widest">Amount ({currencySymbol} Equiv.)</label>
                      <input
                        type="number"
                        placeholder={`Enter amount eg: ${(100 * conversionRate).toFixed(0)}`}
                        value={depAmount}
                        onChange={(e) => setDepAmount(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 select-all outline-none focus:border-[#D4AF37]/50"
                        min="1"
                        step="any"
                      />
                    </div>

                    {/* Tx Hash proof */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-semibold text-white/40 uppercase tracking-widest">Blockchain TXID / TxHash</label>
                      <input
                        type="text"
                        placeholder="Paste transaction receipt hash"
                        value={depTxHash}
                        onChange={(e) => setDepTxHash(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl p-3 text-xs text-white font-mono placeholder-white/20 select-all outline-none focus:border-[#D4AF37]/50"
                      />
                    </div>

                    {/* Status feedback */}
                    {depError && <p className="text-[10px] font-medium text-rose-500 leading-relaxed font-mono">{depError}</p>}
                    {depSuccess && <p className="text-[10px] font-medium text-emerald-400 leading-relaxed font-mono">{depSuccess}</p>}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 px-4 rounded-xl bg-[#D4AF37] hover:brightness-110 active:scale-[0.98] transition-all text-black font-extrabold text-[10px] uppercase tracking-widest cursor-pointer disabled:opacity-40"
                    >
                      {submitting ? 'Registering...' : 'Submit Deposit Proof'}
                    </button>
                  </form>
                </div>

                {/* 2. WITHDRAW PORTAL */}
                <div id="withdraw-section" className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4 scroll-mt-24">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="w-5 h-5 text-[#D4AF37]" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">Withdraw Funds</h3>
                  </div>

                  <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                    {/* Select Network */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-semibold text-white/40 uppercase tracking-widest">Select Output Protocol</label>
                      <select
                        value={withdrawNetwork}
                        onChange={(e) => {
                          setWithdrawNetwork(e.target.value);
                          setWithdrawError('');
                          setWithdrawSuccess('');
                        }}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl p-3 text-xs text-white uppercase font-semibold tracking-wider hover:border-white/20 transition-all outline-none"
                      >
                        <option value="BNB">BNB (BEP20)</option>
                        <option value="TRX">USDT TRON (TRC20)</option>
                        <option value="MATIC">Polygon (MATIC)</option>
                        <option value="EASYPAISA">EasyPaisa (PKR)</option>
                        <option value="JAZZCASH">JazzCash (PKR)</option>
                      </select>
                    </div>

                    {/* Destination Address */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-semibold text-white/40 uppercase tracking-widest">
                        {withdrawNetwork === 'EASYPAISA' ? 'EasyPaisa Account Details' : 
                         withdrawNetwork === 'JAZZCASH' ? 'JazzCash Account Details' : 
                         'Your Private Crypto Wallet Address'}
                      </label>
                      <input
                        type="text"
                        placeholder={
                          withdrawNetwork === 'EASYPAISA' ? 'e.g., 03001234567 - Muhammad Ali' : 
                          withdrawNetwork === 'JAZZCASH' ? 'e.g., 03001234567 - Muhammad Ali' : 
                          'Paste receiver address here'
                        }
                        value={withdrawWallet}
                        onChange={(e) => setWithdrawWallet(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl p-3 text-xs text-white font-mono placeholder-white/20 select-all outline-none focus:border-[#D4AF37]/50"
                      />
                    </div>

                    {/* Amount Block */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[9px] font-semibold text-white/40 uppercase tracking-widest">Amount to Withdraw ({currency})</label>
                        <button
                          type="button"
                          onClick={() => setWithdrawAmount((balance * conversionRate).toFixed(2))}
                          className="text-[9px] font-bold text-[#D4AF37] uppercase tracking-wider hover:underline"
                        >
                          Max Value: {currencySymbol}{(balance * conversionRate).toFixed(2)}
                        </button>
                      </div>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 select-all outline-none focus:border-[#D4AF37]/50"
                        step="any"
                      />
                    </div>

                    {/* Status feedback */}
                    {withdrawError && <p className="text-[10px] font-medium text-rose-500 leading-relaxed font-mono">{withdrawError}</p>}
                    {withdrawSuccess && <p className="text-[10px] font-medium text-emerald-400 leading-relaxed font-mono">{withdrawSuccess}</p>}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 px-4 rounded-xl border border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10 active:scale-[0.98] transition-all font-extrabold text-[10px] uppercase tracking-widest cursor-pointer disabled:opacity-40"
                    >
                      {submitting ? 'Requesting...' : 'Request Withdrawal'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Automated Fast Withdrawals Note */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 flex items-start gap-3.5 text-left">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mt-1.5 shrink-0"></span>
                <div className="space-y-1">
                  <span className="text-[9.5px] font-bold text-emerald-400 tracking-wider uppercase block">Fast Automated Withdrawals Enabled</span>
                  <p className="text-[11.5px] text-white/55 leading-relaxed">
                    Withdrawal requests are processed with elite high-speed routing. Once verified by our active ledger auditors, distributions are dispatched directly to your wallet in record time. For immediate 24/7 support, message us on Telegram at <a href="https://t.me/EarnHubSupportTeam" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-bold underline decoration-dotted">@EarnHubSupportTeam</a>.
                  </p>
                </div>
              </div>

              {/* 3. FUNDING STATEMENT LEDGER */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#D4AF37] mb-2">My Funding Statement History</h4>
                
                {/* Deposits History list */}
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Registered Cryptographic Deposits</p>
                    {(!deposits || deposits.length === 0) ? (
                      <div className="p-4 bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-center text-[10px] text-white/30 uppercase tracking-widest">
                        No cryptographic deposit logs yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[10.5px]">
                          <thead>
                            <tr className="border-b border-white/5 text-white/40 uppercase text-[8px] tracking-widest">
                              <th className="pb-2 font-semibold">Registered Timestamp</th>
                              <th className="pb-2 font-semibold">Protocol Token</th>
                              <th className="pb-2 font-semibold">Value ($)</th>
                              <th className="pb-2 font-semibold">Proof (TXHash)</th>
                              <th className="pb-2 font-semibold text-right">Approval State</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {deposits.map((dep) => (
                              <tr key={dep.id} className="text-white/80">
                                <td className="py-2.5 text-[10px] font-mono text-white/40">{dep.timestamp}</td>
                                <td className="py-2.5 font-bold uppercase text-white">{dep.network}</td>
                                <td className="py-2.5 font-medium text-[#D4AF37]">{currencySymbol}{(dep.amount * conversionRate).toFixed(2)}</td>
                                <td className="py-2.5 font-mono text-white/40 text-[9px] truncate max-w-[120px]" title={dep.txHash}>{dep.txHash}</td>
                                <td className="py-2.5 text-right font-bold uppercase tracking-wider text-[9px]">
                                  {dep.status === 'pending' && <span className="text-amber-500 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">Pending Validation</span>}
                                  {dep.status === 'approved' && <span className="text-emerald-400 font-semibold bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-md">Approved</span>}
                                  {dep.status === 'rejected' && <span className="text-rose-500 font-semibold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">Rejected</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <hr className="border-white/5" />

                  {/* Withdrawals list */}
                  <div>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Payout & Withdrawal Statements</p>
                    {(!withdrawals || withdrawals.length === 0) ? (
                      <div className="p-4 bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-center text-[10px] text-white/30 uppercase tracking-widest">
                        No payout withdrawal payouts logged.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[10.5px]">
                          <thead>
                            <tr className="border-b border-white/5 text-white/40 uppercase text-[8px] tracking-widest">
                              <th className="pb-2 font-semibold">Requested Timestamp</th>
                              <th className="pb-2 font-semibold">Method</th>
                              <th className="pb-2 font-semibold">Destination Address/Account</th>
                              <th className="pb-2 font-semibold">Payout Value</th>
                              <th className="pb-2 font-semibold text-right">Approval State</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {withdrawals.map((wit) => (
                              <tr key={wit.id} className="text-white/80">
                                <td className="py-2.5 text-[10px] font-mono text-white/40">{wit.timestamp}</td>
                                <td className="py-2.5 font-bold uppercase text-white">{wit.network}</td>
                                <td className="py-2.5 font-mono text-white/40 text-[9px] truncate max-w-[120px]" title={wit.wallet}>{wit.wallet}</td>
                                <td className="py-2.5 font-medium text-[#D4AF37]">{currencySymbol}{(wit.amount * conversionRate).toFixed(2)}</td>
                                <td className="py-2.5 text-right font-bold uppercase tracking-wider text-[9px]">
                                  {wit.status === 'pending' && <span className="text-amber-500 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">Pending Approval</span>}
                                  {wit.status === 'approved' && <span className="text-emerald-400 font-semibold bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-md">Disbursed</span>}
                                  {wit.status === 'rejected' && <span className="text-rose-500 font-semibold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">Denied</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'faq' && (
            <motion.div
              key="faq-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 scroll-mt-24"
              id="faq-section"
            >
              <FaqSection />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
