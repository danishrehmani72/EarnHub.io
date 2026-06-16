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
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX
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
  CartesianGrid,
  Legend
} from 'recharts';
import { FaqSection } from './FaqSection';
import { ReferralLog, DepositLog, WithdrawalLog, UserPlan, DailyRewardLog } from '../types';
import { AvatarIcon, getAvatarConfig } from '../lib/avatars';

import { PlanMatrix } from './PlanMatrix';
import { playSound } from '../lib/sounds';

interface DashboardCardProps {
  name: string;
  userId: string;
  balance: number;
  referralCount: number;
  logs: ReferralLog[];
  avatar?: string;
  deposits?: DepositLog[];
  withdrawals?: WithdrawalLog[];
  investments?: UserPlan[];
  onCreateDeposit?: (amount: number, network: string, txHash: string) => Promise<void>;
  onCreateWithdrawal?: (amount: number, network: string, wallet: string) => Promise<void>;
  onCreatePlan?: (planId: string, amount: number) => Promise<void>;
  onCancelPlan?: (invId: string) => Promise<void>;
  onUpdateTxStatus?: (type: 'deposit' | 'withdrawal', txId: string, status: 'approved' | 'rejected') => Promise<void>;
  onSignOut?: () => Promise<void> | void;
  investmentProfits?: number;
  onAddToast: (message: string, type: 'success' | 'error', sound?: any) => void;
  userProfile?: any;
  onClaimDailyReward?: (amount: number) => Promise<void>;
  virtualDays?: number;
  activeTab?: 'overview' | 'funding' | 'faq';
  onActiveTabChange?: (tab: 'overview' | 'funding' | 'faq') => void;
  dailyRewardLogs?: DailyRewardLog[];
  onRefresh?: () => Promise<void>;
  globalSettings?: {
    yieldMultiplier: number;
    systemAnnouncement: string;
    isAnnouncementActive: boolean;
  };
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
  investments = [],
  onCreateDeposit,
  onCreateWithdrawal,
  onCreatePlan,
  onCancelPlan,
  onUpdateTxStatus,
  onSignOut,
  investmentProfits = 0,
  onAddToast,
  userProfile,
  onClaimDailyReward,
  virtualDays = 0,
  activeTab: activeTabProp,
  onActiveTabChange,
  dailyRewardLogs = [],
  onRefresh,
  globalSettings,
}: DashboardCardProps) {
  const [copied, setCopied] = useState(false);
  const [activeTabLocal, setActiveTabLocal] = useState<'overview' | 'funding' | 'faq'>('overview');

  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sound_muted') === 'true';
    }
    return false;
  });

  const toggleMuted = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_muted', String(nextMuted));
    }
    if (!nextMuted) {
      setTimeout(() => {
        playSound('new_referral');
      }, 50);
      onAddToast?.("🔊 Audio feedback enabled!", "success");
    } else {
      onAddToast?.("🔇 Audio feedback muted", "error");
    }
  };

  // Interactive Simulator States
  const [calcAmount, setCalcAmount] = useState(25);
  const [calcDays, setCalcDays] = useState(30);

  // Real-time projected yield calculation
  const calculatedProjProfit = useMemo(() => {
    let percent = 0;
    if (calcAmount >= 100) percent = 7;
    else if (calcAmount >= 50) percent = 5;
    else if (calcAmount >= 15) percent = 4;
    else if (calcAmount >= 5) percent = 3;

    const baseDailyRate = calcAmount * (percent / 100);
    const activeMultiplier = globalSettings?.yieldMultiplier || 1.0;
    return baseDailyRate * calcDays * activeMultiplier;
  }, [calcAmount, calcDays, globalSettings?.yieldMultiplier]);
  
  // High fidelity successful withdraw animation states (TikTok/YouTube friendly)
  const [recentSuccessWithdraw, setRecentSuccessWithdraw] = useState<{amount: number, network: string, wallet: string} | null>(null);
  const [successStep, setSuccessStep] = useState<'loading' | 'completed'>('loading');
  const [successProgress, setSuccessProgress] = useState(0);

  const activeTab = activeTabProp !== undefined ? activeTabProp : activeTabLocal;
  const setActiveTab = onActiveTabChange !== undefined ? onActiveTabChange : setActiveTabLocal;
  const [adminModeType, setAdminModeType] = useState<'sandbox' | 'platform_global'>('platform_global');

  // Manual Refresh & Pull-to-Refresh States and Handlers
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullStatus, setPullStatus] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  const touchStartRef = useRef(0);
  const pullingRef = useRef(false);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      onAddToast('Database stats and records updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      onAddToast('Failed to force refresh from database.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing && pullStatus === 'idle') {
      touchStartRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pullingRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;
    if (diff > 0) {
      const distance = Math.min(80, Math.pow(diff, 0.85));
      setPullDistance(distance);
      if (distance >= 50) {
        setPullStatus('ready');
      } else {
        setPullStatus('pulling');
      }
    } else {
      setPullDistance(0);
      setPullStatus('idle');
    }
  };

  const handleTouchEnd = async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    if (pullStatus === 'ready') {
      setPullStatus('refreshing');
      setIsRefreshing(true);
      setPullDistance(55);
      try {
        if (onRefresh) {
          await onRefresh();
        }
        onAddToast('Pull-to-refresh: Data updated successfully!', 'success');
      } catch (err) {
        console.error(err);
        onAddToast('Failed to refresh data.', 'error');
      } finally {
        setPullStatus('idle');
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullStatus('idle');
      setPullDistance(0);
    }
  };

  // Cooldown calculation for daily check-in claims
  const [claimCooldown, setClaimCooldown] = useState('');

  // Pagination states
  const [depositsPage, setDepositsPage] = useState(1);
  const depositsPerPage = 5;
  const totalDepositsPages = Math.ceil((deposits || []).length / depositsPerPage);
  const paginatedDeposits = useMemo(() => {
    return (deposits || []).slice((depositsPage - 1) * depositsPerPage, depositsPage * depositsPerPage);
  }, [deposits, depositsPage, depositsPerPage]);

  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const withdrawalsPerPage = 4;
  const totalWithdrawalsPages = Math.ceil((withdrawals || []).length / withdrawalsPerPage);
  const reversedWithdrawals = useMemo(() => (withdrawals || []).slice().reverse(), [withdrawals]);
  const paginatedWithdrawals = useMemo(() => {
    return reversedWithdrawals.slice((withdrawalsPage - 1) * withdrawalsPerPage, withdrawalsPage * withdrawalsPerPage);
  }, [reversedWithdrawals, withdrawalsPage, withdrawalsPerPage]);

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

  // Pakistan Deposit states
  const [depositMethodTab, setDepositMethodTab] = useState<'pakistan' | 'crypto'>('pakistan');
  const [pkDepMethod, setPkDepMethod] = useState<'EASYPAISA' | 'JAZZCASH' | 'SADAPAY' | 'NAYAPAY' | 'BANK'>('EASYPAISA');
  const [pkDepAmount, setPkDepAmount] = useState('');
  const [pkDepSenderNumber, setPkDepSenderNumber] = useState('');
  const [pkDepSenderName, setPkDepSenderName] = useState('');
  const [pkDepTxid, setPkDepTxid] = useState('');
  const [pkDepError, setPkDepError] = useState('');
  const [pkDepSuccess, setPkDepSuccess] = useState('');
  const [copiedPkDepNumber, setCopiedPkDepNumber] = useState(false);

  const [withdrawNetwork, setWithdrawNetwork] = useState('BNB');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawWallet, setWithdrawWallet] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  // Pakistan Withdrawal states
  const [withdrawMethodTab, setWithdrawMethodTab] = useState<'pakistan' | 'crypto'>('pakistan');
  const [pkMethod, setPkMethod] = useState<'EASYPAISA' | 'JAZZCASH' | 'SADAPAY' | 'NAYAPAY' | 'BANK'>('EASYPAISA');
  const [pkWithdrawAmount, setPkWithdrawAmount] = useState('');
  const [pkWithdrawNumber, setPkWithdrawNumber] = useState('');
  const [pkWithdrawName, setPkWithdrawName] = useState('');
  const [pkWithdrawError, setPkWithdrawError] = useState('');
  const [pkWithdrawSuccess, setPkWithdrawSuccess] = useState('');
  const [copiedPkNumber, setCopiedPkNumber] = useState(false);

  const [submitting, setSubmitting] = useState(false);



  // Construct referral link using current origin or a beautiful fallback
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${userId}` 
    : `https://moneymindspace.com/?ref=${userId}`;

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

  const handleCopyPkNumber = async () => {
    try {
      await navigator.clipboard.writeText('03435319202');
      setCopiedPkNumber(true);
      setTimeout(() => setCopiedPkNumber(false), 2500);
    } catch (err) {
      console.error('Failed to copy Pakistan withdraw number', err);
    }
  };

  const handleCopyPkDepNumber = async () => {
    try {
      await navigator.clipboard.writeText('03435319202');
      setCopiedPkDepNumber(true);
      setTimeout(() => setCopiedPkDepNumber(false), 2500);
    } catch (err) {
      console.error('Failed to copy Pakistan deposit number', err);
    }
  };

  const handlePkDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPkDepError('');
    setPkDepSuccess('');

    const amtInput = parseFloat(pkDepAmount);
    const amtUSD = amtInput / conversionRate;
    if (!amtInput || amtUSD < 5) {
      setPkDepError(`❌ Minimum deposit amount is ${currencySymbol}${Math.ceil(5 * conversionRate)}.`);
      return;
    }

    if (!pkDepSenderNumber.trim() || !pkDepSenderName.trim() || !pkDepTxid.trim()) {
      setPkDepError('❌ Please fill in all payment details and Transaction ID correctly.');
      return;
    }

    setSubmitting(true);
    try {
      if (onCreateDeposit) {
        const depositDetails = `${pkDepMethod === 'EASYPAISA' ? 'Easypaisa' : pkDepMethod === 'JAZZCASH' ? 'JazzCash' : pkDepMethod === 'SADAPAY' ? 'SadaPay' : pkDepMethod === 'NAYAPAY' ? 'NayaPay' : 'Bank Transfer'} - Number: ${pkDepSenderNumber.trim()} | Name: ${pkDepSenderName.trim()}`;
        await onCreateDeposit(amtUSD, pkDepMethod, `${pkDepTxid.trim()} (${depositDetails})`);
        
        setPkDepSuccess('✅ Your deposit request has been submitted successfully. It will be credited after verification within 2 minutes to 2 hours.');
        setPkDepAmount('');
        setPkDepSenderNumber('');
        setPkDepSenderName('');
        setPkDepTxid('');
      } else {
        setPkDepError('❌ Deposit system configuration issues. Please try again.');
      }
    } catch (err) {
      setPkDepError('❌ Could not save deposit request.');
    } finally {
      setSubmitting(false);
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

  const handlePkWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPkWithdrawError('');
    setPkWithdrawSuccess('');

    const amtInput = parseFloat(pkWithdrawAmount);
    const amtUSD = amtInput / conversionRate;
    if (!amtInput || amtUSD < 10) {
      setPkWithdrawError(`❌ Minimum withdrawal amount is ${currencySymbol}${Math.ceil(10 * conversionRate)}.`);
      return;
    }

    if (amtUSD > balance) {
      setPkWithdrawError(`❌ Insufficient funds. Your live balance is ${currencySymbol}${(balance * conversionRate).toFixed(2)}.`);
      return;
    }

    if (!pkWithdrawNumber.trim() || !pkWithdrawName.trim()) {
      setPkWithdrawError('❌ Please fill in all payment details correctly.');
      return;
    }

    setSubmitting(true);
    try {
      if (onCreateWithdrawal) {
        const methodName = pkMethod === 'EASYPAISA' ? 'Easypaisa' :
                           pkMethod === 'JAZZCASH' ? 'JazzCash' :
                           pkMethod === 'SADAPAY' ? 'SadaPay' :
                           pkMethod === 'NAYAPAY' ? 'NayaPay' : 'Bank Transfer';
        const walletDetails = `${methodName} - Number/Account: ${pkWithdrawNumber.trim()} | Account Title: ${pkWithdrawName.trim()}`;
        await onCreateWithdrawal(amtUSD, pkMethod, walletDetails);
        setPkWithdrawSuccess('✅ Your withdrawal request has been submitted successfully. Processing may take 2 minutes to 2 hours after verification (24/7).');
        setPkWithdrawAmount('');
        setPkWithdrawNumber('');
        setPkWithdrawName('');
      } else {
        setPkWithdrawError('❌ Withdrawal system configuration issues. Please try again.');
      }
    } catch (err) {
      setPkWithdrawError('❌ Could not save withdrawal request.');
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
  const activeInvestments = useMemo(() => {
    return (investments || []).filter(inv => inv.status === 'active');
  }, [investments]);

  const totalActiveInvestedSum = useMemo(() => {
    return activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);
  }, [activeInvestments]);

  const hasActivePlan = activeInvestments.length > 0;
  const activePlanStatus = hasActivePlan ? 'Active Plan' : 'Inactive Plan';

  // Calculate sum of daily performance percentages of all surviving active plan deposits
  const dailyProfitRate = useMemo(() => {
    return activeInvestments.reduce((sum, inv) => {
      let percent = 0;
      if (inv.amount >= 100) percent = 7;
      else if (inv.amount >= 50) percent = 5;
      else if (inv.amount >= 15) percent = 4;
      else if (inv.amount >= 5) percent = 3;
      return sum + (inv.amount * (percent / 100));
    }, 0);
  }, [activeInvestments]);

  const earliestActiveInvestment = useMemo(() => {
    if (activeInvestments.length === 0) return null;
    return [...activeInvestments].sort((a, b) => {
      const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.timestamp).getTime() || 0;
      const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.timestamp).getTime() || 0;
      return aTime - bTime;
    })[0];
  }, [activeInvestments]);

  const [timeRemaining, setTimeRemaining] = useState('24h 00m 00s');

  useEffect(() => {
    if (!earliestActiveInvestment) {
      setTimeRemaining('--h --m --s');
      return;
    }

    const updateTimer = () => {
      const depTime = earliestActiveInvestment.createdAt?.seconds 
        ? earliestActiveInvestment.createdAt.seconds * 1000 
        : new Date(earliestActiveInvestment.timestamp).getTime() || Date.now();
      
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
  }, [earliestActiveInvestment]);

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

          const dailyRate = dep.amount * (percent / 100) * (globalSettings?.yieldMultiplier || 1.0);

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

  // Compute chronological progression of Daily Bonus and Investment Profits over the last 10 days
  const bonusAndProfitChartData = useMemo(() => {
    const dataPoints: {
      date: string;
      bonus: number;
      profit: number;
      cumulativeBonus: number;
      cumulativeProfit: number;
    }[] = [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Generate last 10 days
    for (let i = 9; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      dataPoints.push({
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        bonus: 0,
        profit: 0,
        cumulativeBonus: 0,
        cumulativeProfit: 0,
      });
    }

    // Populate Daily Rewards (Bonus check-ins)
    if (dailyRewardLogs && dailyRewardLogs.length > 0) {
      dailyRewardLogs.forEach((log) => {
        const amt = Number(log.amount) || 0;
        const ts = log.createdAt?.seconds 
          ? log.createdAt.seconds * 1000 
          : new Date(log.timestamp).getTime() || 0;
        
        if (!ts) return;
        const logDate = new Date(ts);
        const dayLabel = logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        
        const pt = dataPoints.find(p => p.date === dayLabel);
        if (pt) {
          pt.bonus += amt;
        }
      });
    }

    // Populate Investment Profits (Staking returns)
    // We scan both active plans (investments) and approved deposits (which act as staking nodes)
    const activeAssets: { amount: number; time: number }[] = [];

    // 1. From approved deposits
    if (deposits && deposits.length > 0) {
      deposits
        .filter((d) => d.status === 'approved')
        .forEach((dep) => {
          const depTime = dep.createdAt?.seconds 
            ? dep.createdAt.seconds * 1000 
            : new Date(dep.timestamp).getTime() || 0;
          if (depTime) {
            activeAssets.push({ amount: dep.amount, time: depTime });
          }
        });
    }

    // 2. From investments (purchased plans)
    if (investments && investments.length > 0) {
      investments
        .filter((inv) => inv.status === 'active')
        .forEach((inv) => {
          const invTime = inv.createdAt?.seconds 
            ? inv.createdAt.seconds * 1000 
            : new Date(inv.timestamp).getTime() || 0;
          if (invTime) {
            activeAssets.push({ amount: inv.amount, time: invTime });
          }
        });
    }

    // For each calendar day in our chart, calculate the total active investment profit generated on that day
    dataPoints.forEach((pt, dayIdx) => {
      // Find the start date timestamp of this calendar day
      const targetDay = new Date(today.getTime() - (9 - dayIdx) * 24 * 60 * 60 * 1000);
      const targetTime = targetDay.getTime();

      let dailyProfitSum = 0;
      activeAssets.forEach((asset) => {
        // An asset generates profit starting the day after its creation
        if (targetTime > asset.time) {
          let percent = 0;
          if (asset.amount >= 100) percent = 7;
          else if (asset.amount >= 50) percent = 5;
          else if (asset.amount >= 15) percent = 4;
          else if (asset.amount >= 5) percent = 3;

          dailyProfitSum += asset.amount * (percent / 100);
        }
      });
      pt.profit = dailyProfitSum;
    });

    // Compute cumulative trends over this 10-day period
    let runBonus = userProfile?.signupBonus || 0.10; // Start with the signup bonus as initial seed base
    let runProfit = 0;

    dataPoints.forEach((pt) => {
      runBonus += pt.bonus;
      runProfit += pt.profit;
      pt.cumulativeBonus = runBonus;
      pt.cumulativeProfit = runProfit;
    });

    return dataPoints;
  }, [dailyRewardLogs, deposits, investments, userProfile?.signupBonus]);

  // Determine if there has been high yield / high growth detected (e.g. peak combined daily yield exceeds 0.08 USD)
  const hasHighGrowth = useMemo(() => {
    if (!bonusAndProfitChartData || bonusAndProfitChartData.length === 0) return false;
    const maxDayYield = Math.max(...bonusAndProfitChartData.map(pt => pt.bonus + pt.profit));
    // High Growth threshold: active staking/rewards exceeding 0.08 equivalent base units
    return maxDayYield >= 0.08;
  }, [bonusAndProfitChartData]);

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
      className="w-full max-w-2xl bg-[#111111] rounded-3xl border border-white/5 shadow-2xl shadow-[#020202]/80 overflow-hidden text-[#E5E7EB] relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull down refresh indicator */}
      <div 
        className="overflow-hidden transition-all duration-200 flex items-center justify-center bg-[#070707] border-b border-white/5 relative z-50 text-[#D4AF37]"
        style={{ height: pullDistance > 0 || pullStatus === 'refreshing' ? `${Math.max(pullDistance, pullStatus === 'refreshing' ? 50 : 0)}px` : '0px' }}
      >
        <div className="flex items-center gap-2.5 py-2.5">
          <RefreshCw className={`w-3.5 h-3.5 ${pullStatus === 'refreshing' ? 'animate-spin' : ''}`} style={{ transform: pullStatus !== 'refreshing' ? `rotate(${pullDistance * 6}deg)` : undefined }} />
          <span className="text-[9px] uppercase tracking-[0.18em] font-sans font-bold">
            {pullStatus === 'pulling' && 'Pull down to refresh'}
            {pullStatus === 'ready' && 'Release to refresh'}
            {pullStatus === 'refreshing' && 'Refreshing user secure state...'}
          </span>
        </div>
      </div>

      {/* SECURITY / SYSTEM LIVE BROADCAST ANNOUNCEMENT LEVEL 1 MARQUEE */}
      {globalSettings?.isAnnouncementActive && globalSettings?.systemAnnouncement && (
        <div className="bg-[#1a140b] border-b border-amber-500/10 px-4 py-2.5 flex items-center gap-3 relative overflow-hidden z-20 shrink-0 font-sans">
          <div className="absolute top-0 left-0 w-1 md:w-1.5 h-full bg-[#D4AF37]" />
          <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0 animate-pulse" />
          <div className="flex-1 overflow-hidden relative">
            <div className="animate-marquee whitespace-nowrap text-[10px] font-bold text-amber-200 tracking-wider">
              {globalSettings.systemAnnouncement}
            </div>
          </div>
          <span className="text-[7.5px] font-mono font-black text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/25 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 select-none">
            Live Promo {globalSettings.yieldMultiplier > 1.0 ? `x${globalSettings.yieldMultiplier}` : "Broadcast"}
          </span>
        </div>
      )}

      {/* Header with User summary */}
      <div 
        className="bg-[#0C0C0C] border-b border-white/5 p-6 md:p-8 relative overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(212, 175, 55, 0.05) 0%, rgba(0, 0, 0, 0) 70%), radial-gradient(circle at 30% 100%, rgba(138, 109, 59, 0.03) 0%, rgba(0, 0, 0, 0) 60%)'
        }}
      >

        <div className="mb-6 z-10 relative">
          <h1 className="text-3xl font-bold font-serif text-white">MoneyMind Space</h1>
        </div>

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

            {/* Global Audio Sound Feedback Toggle */}
            <button
              onClick={toggleMuted}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 h-8 ${
                isMuted
                  ? 'border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:border-rose-500/40'
                  : 'border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:border-emerald-500/40'
              }`}
              title={isMuted ? "Unmute system sounds" : "Mute system sounds"}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden xs:inline">Active</span>
                </>
              )}
            </button>

            {onRefresh && (
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/10 hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/5 text-white/60 hover:text-[#D4AF37] transition-all cursor-pointer flex items-center gap-1.5 bg-black/40 h-8 disabled:opacity-50"
                title="Force sync stats from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing' : 'Refresh'}
              </button>
            )}

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
          className={`py-4 px-2 sm:py-5 sm:px-3 rounded-xl text-[9px] xs:text-[10px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] transition-all duration-150 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20 shadow-md shadow-black/10'
              : 'text-white/40 hover:text-white/80 border border-transparent hover:bg-white/5'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 whitespace-nowrap shrink-0" />
          <span className="text-center leading-tight">Dashboard</span>
        </button>
        
        <button
          onClick={() => setActiveTab('funding')}
          className={`py-4 px-2 sm:py-5 sm:px-3 rounded-xl text-[9px] xs:text-[10px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] transition-all duration-150 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            activeTab === 'funding'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20 shadow-md shadow-black/10'
              : 'text-white/40 hover:text-white/80 border border-transparent hover:bg-white/5'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 whitespace-nowrap shrink-0" />
          <span className="text-center leading-tight">Withdraw & Deposit</span>
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`py-4 px-2 sm:py-5 sm:px-3 rounded-xl text-[9px] xs:text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-150 flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'faq'
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20 shadow-md shadow-black/10'
              : 'text-white/40 hover:text-white/80 border border-transparent hover:bg-white/5'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 whitespace-nowrap shrink-0" />
          <span className="text-center leading-tight">FAQ Section</span>
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
              {/* Dynamic Cards: Balance, Investment, Timer, Referrals */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
                
                {/* 1. Live Wallet Balance */}
                <motion.div 
                  id="live-wallet-balance-card" 
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    scale: flashType === 'up' ? 1.03 : flashType === 'down' ? 0.97 : 1.0,
                    borderColor: flashType === 'up' ? 'rgba(16,185,129,0.4)' : flashType === 'down' ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.05)',
                    backgroundColor: flashType === 'up' ? 'rgba(16,185,129,0.1)' : flashType === 'down' ? 'rgba(244,63,94,0.1)' : 'rgba(22,22,22,1)',
                    boxShadow: flashType === 'up' 
                      ? '0 0 25px rgba(16,185,129,0.15), inset 0 0 10px rgba(16,185,129,0.1)' 
                      : flashType === 'down' 
                      ? '0 0 25px rgba(244,63,94,0.15), inset 0 0 10px rgba(244,63,94,0.1)' 
                      : '0 0 0px rgba(0,0,0,0)'
                  }}
                  exit={{ opacity: 0, scale: 0.92, y: -15 }}
                  whileHover={{ y: -3, scale: 1.015, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 260, 
                    damping: 20,
                    delay: 0.04,
                    layout: { type: "spring", stiffness: 350, damping: 25 }
                  }}
                  className="p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden shadow-inner border rounded-2xl cursor-pointer"
                >
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
                  <motion.div 
                    layout="position"
                    className={`my-1 text-2xl font-serif tracking-tight z-10 flex items-center gap-1.5 transition-all duration-300 ${
                      flashType === 'up'
                        ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                        : flashType === 'down'
                        ? 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                        : 'text-[#D4AF37]'
                    }`}
                  >
                    <span>{currencySymbol}</span>
                    <motion.span 
                      key={`${currency}-${balance}`} 
                      initial={{ scale: 0.95, filter: "brightness(1.2)" }}
                      animate={{ scale: 1, filter: "brightness(1)" }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                      layout="position"
                    >
                      {animatedBalanceDisplay}
                    </motion.span>

                    <AnimatePresence>
                      {flashType === 'up' && (
                        <motion.span
                          initial={{ opacity: 0, x: -5, scale: 0.8 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 5, scale: 0.8 }}
                          className="text-[8px] font-mono font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1 rounded select-none uppercase tracking-widest leading-none py-0.5 ml-1"
                        >
                          +IN
                        </motion.span>
                      )}
                      {flashType === 'down' && (
                        <motion.span
                          initial={{ opacity: 0, x: -5, scale: 0.8 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 5, scale: 0.8 }}
                          className="text-[8px] font-mono font-black text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1 rounded select-none uppercase tracking-widest leading-none py-0.5 ml-1"
                        >
                          -OUT
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <div className={`text-[8.5px] font-medium flex items-center justify-between gap-1 z-10 leading-normal transition-all duration-300 ${
                    flashType === 'up'
                      ? 'text-emerald-300 animate-pulse'
                      : flashType === 'down'
                      ? 'text-rose-300 animate-pulse'
                      : 'text-emerald-400'
                  }`}>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-2.5 h-2.5 shrink-0" /> {
                        flashType === 'up'
                          ? 'Yield auto-ledger updated'
                          : flashType === 'down'
                          ? 'Funds debited successfully'
                          : 'Real-time active ledger'
                      }
                    </span>
                    {hasHighGrowth && (
                      <span className="px-1.5 py-0.5 rounded text-[7.5px] font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse shrink-0">
                        High Growth
                      </span>
                    )}
                  </div>
                </motion.div>

                {/* 2. Next Daily Payout Timer */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -15 }}
                  whileHover={{ y: -3, scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 260, 
                    damping: 20, 
                    delay: 0.12 
                  }}
                  className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
                >
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
                </motion.div>

                {/* 3. Total Referrals */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -15 }}
                  whileHover={{ y: -3, scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 260, 
                    damping: 20, 
                    delay: 0.20 
                  }}
                  className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
                >
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
                </motion.div>

              </div>

              <PlanMatrix
                balance={balance}
                investments={investments}
                onCreatePlan={onCreatePlan!}
                onCancelPlan={onCancelPlan!}
                currencySymbol={currencySymbol}
                conversionRate={conversionRate}
              />

              {/* LIVE STAKING PROJECTOR & INTEREST ESTIMATOR */}
              <div className="bg-[#121212]/50 border border-white/5 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="space-y-0.5 text-left">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
                      Dynamic Staking Yield Estimator
                    </h4>
                    <p className="text-[8.5px] text-white/40 font-sans">Simulate and project your future earnings in real-time</p>
                  </div>
                  {globalSettings && globalSettings.yieldMultiplier > 1.0 && (
                    <span className="text-[7px] font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider animate-bounce select-none">
                      Promo Active: {globalSettings.yieldMultiplier}x Boost!
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  {/* Slider 1: Amount */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between text-[9px] font-bold text-white/50 uppercase tracking-wider font-sans">
                      <span>Staking Capital Amount</span>
                      <span className="text-[#D4AF37] font-mono text-[11px] font-black">
                        {currencySymbol}{(calcAmount * conversionRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="5"
                      max="1000"
                      step="5"
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(Number(e.target.value))}
                      className="w-full accent-[#D4AF37] bg-black/60 h-1.5 rounded-lg appearance-none cursor-pointer border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
                    />
                    <div className="flex justify-between text-[7px] font-mono text-white/30">
                      <span>Min: {currencySymbol}{(5 * conversionRate).toFixed(2)}</span>
                      <span>Mid: {currencySymbol}{(500 * conversionRate).toFixed(2)}</span>
                      <span>Max: {currencySymbol}{(1000 * conversionRate).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Slider 2: Duration */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between text-[9px] font-bold text-white/50 uppercase tracking-wider font-sans">
                      <span>Lock-in Duration (Days)</span>
                      <span className="text-[#D4AF37] font-mono text-[11px] font-black">
                        {calcDays} Days
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="365"
                      step="1"
                      value={calcDays}
                      onChange={(e) => setCalcDays(Number(e.target.value))}
                      className="w-full accent-[#D4AF37] bg-black/60 h-1.5 rounded-lg appearance-none cursor-pointer border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
                    />
                    <div className="flex justify-between text-[7px] font-mono text-white/30">
                      <span>1 Day</span>
                      <span>180 Days</span>
                      <span>365 Days</span>
                    </div>
                  </div>

                  {/* Summary output table cards */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-3 text-left space-y-1">
                      <span className="text-[7.5px] uppercase tracking-widest font-black text-white/40 font-sans block">Dynamic Daily Yield</span>
                      <p className="text-[12px] font-serif font-bold text-white leading-tight">
                        {currencySymbol}{(( (calcAmount >= 100 ? 0.07 : calcAmount >= 50 ? 0.05 : calcAmount >= 15 ? 0.04 : 0.03) * calcAmount * (globalSettings?.yieldMultiplier || 1.0) ) * conversionRate).toFixed(2)}
                      </p>
                      <span className="text-[6.5px] font-mono text-[#D4AF37]/85 block">
                        Based on {calcAmount >= 100 ? "7%" : calcAmount >= 50 ? "5%" : calcAmount >= 15 ? "4%" : "3%"} Plan tier rate
                      </span>
                    </div>

                    <div className="bg-[#1c160c]/35 border border-amber-500/10 rounded-2xl p-3 text-left space-y-1">
                      <span className="text-[7.5px] uppercase tracking-widest font-black text-[#D4AF37]/65 font-sans block">Total Est. Staking Gains</span>
                      <p className="text-[13px] font-serif font-black text-amber-400 leading-tight">
                        {currencySymbol}{(calculatedProjProfit * conversionRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-[6.5px] font-mono text-white/30 block">
                        Capital return after {calcDays}d
                      </span>
                    </div>
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

              {/* Yield & Reward Analytics: Daily Check-In Bonus vs Staking Dividends Trend */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[11px] uppercase tracking-wider font-sans font-semibold text-white/40">Yield & Reward Analytics</h4>
                      {hasHighGrowth && (
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-pulse"
                          title={`Peak daily yield has exceeded ${currencySymbol}${(0.08 * conversionRate).toFixed(2)}`}
                        >
                          <TrendingUp className="w-2.5 h-2.5 animate-bounce" /> High Growth Detected
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/30 leading-none">Daily check-in bonuses vs. active staking dividends over time</p>
                  </div>
                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-[#D4AF37]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                      Bonus Trend
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Staking Yield
                    </span>
                  </div>
                </div>
                
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bonusAndProfitChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis 
                        dataKey="date" 
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
                        tickFormatter={(val) => `${currencySymbol.trim()}${(val * conversionRate).toFixed(1)}`}
                      />
                      <Tooltip 
                        cursor={{ stroke: 'rgba(215, 175, 52, 0.1)', strokeWidth: 1 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const bonusAccum = Number(payload[0]?.value) || 0;
                            const profitAccum = Number(payload[1]?.value) || 0;
                            const d = payload[0]?.payload || {};
                            return (
                              <div className="bg-[#121212] border border-white/10 p-3 rounded-xl shadow-2xl font-sans text-xs space-y-1.5 min-w-[170px]">
                                <p className="text-white/40 font-bold uppercase tracking-widest text-[8px] mb-1">
                                  {d.date} Performance
                                </p>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Daily Bonus:
                                  </span>
                                  <span className="text-[#D4AF37] font-mono font-bold">
                                    {currencySymbol}{(d.bonus * conversionRate).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Staking Yield:
                                  </span>
                                  <span className="text-emerald-400 font-mono font-bold">
                                    {currencySymbol}{(d.profit * conversionRate).toFixed(2)}
                                  </span>
                                </div>
                                <div className="border-t border-white/5 pt-1.5 space-y-1">
                                  <div className="flex items-center justify-between gap-4 text-[10px]">
                                    <span className="text-white/40 font-semibold">Bonus Total:</span>
                                    <span className="text-[#D4AF37] font-bold font-mono">
                                      {currencySymbol}{(bonusAccum * conversionRate).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-[10px]">
                                    <span className="text-white/40 font-semibold">Staking Total:</span>
                                    <span className="text-emerald-400 font-bold font-mono">
                                      {currencySymbol}{(profitAccum * conversionRate).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-[10px] border-t border-white/5 pt-1">
                                    <span className="text-white/60 font-semibold">Aggregate Profit:</span>
                                    <span className="text-white font-bold font-mono">
                                      {currencySymbol}{((bonusAccum + profitAccum) * conversionRate).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                        wrapperStyle={{ outline: 'none' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cumulativeBonus" 
                        name="Bonus Rewards"
                        stroke="#D4AF37" 
                        strokeWidth={2}
                        dot={{ r: 2.5, stroke: '#111111', strokeWidth: 1, fill: '#D4AF37' }}
                        activeDot={{ r: 4.5, stroke: '#111111', strokeWidth: 1.5, fill: '#D4AF37' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cumulativeProfit" 
                        name="Staking Profits"
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={{ r: 2.5, stroke: '#111111', strokeWidth: 1, fill: '#10b981' }}
                        activeDot={{ r: 4.5, stroke: '#111111', strokeWidth: 1.5, fill: '#10b981' }}
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
                    {/* Streak Progress Bar */}
                    <div className="pt-2 max-w-md">
                      <div className="flex justify-between items-center mb-1.5 mt-2">
                        <span className="text-[9px] text-white/50 font-bold uppercase tracking-wider">Streak Milestone Progress</span>
                        <span className="text-[10px] text-[#D4AF37] font-black">{userProfile?.claimStreak || 0} / {Math.floor((userProfile?.claimStreak || 0) / 5) * 5 + 5} Days</span>
                      </div>
                      <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/10 relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(((userProfile?.claimStreak || 0) % 5) / 5) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#D4AF37]/40 to-[#D4AF37] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.7)]"
                        />
                      </div>
                    </div>
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
                        const minAmt = currentStreak >= 5 ? 0.28 : 0.105;
                        const maxAmt = currentStreak >= 5 ? 0.42 : 0.245;
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

              {/* Premium Official Telegram Community & Public Group Card */}
              <div className="bg-[#0D0D0C] border-2 border-[#D4AF37]/35 rounded-2xl p-6 relative overflow-hidden mt-6 transition-all hover:border-[#D4AF37]/65 shadow-[0_0_20px_rgba(212,175,55,0.05)]">
                {/* Premium gold & telegram blue decorative gradients */}
                <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-[#24A1DE]/15 to-[#D4AF37]/10 blur-3xl pointer-events-none" />
                <div className="absolute top-2 right-2 text-[#24A1DE]/5 font-black text-6xl select-none uppercase tracking-widest font-serif">
                  TG
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-3 max-w-xl text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#24A1DE]/10 border border-[#24A1DE]/25 text-[#24A1DE] text-[8.5px] uppercase font-black tracking-wider">
                        💬 Public Group B
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[#D4AF37] text-[8.5px] uppercase font-black tracking-wider">
                        💎 Moneymindspace.online Official
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white tracking-wide">
                      Join Our Global Telegram Community Channel
                    </h3>
                    
                    <p className="text-xs text-white/70 leading-relaxed">
                      Become part of our professional community to receive secure insights and daily updates regarding <strong className="text-[#D4AF37] hover:underline cursor-pointer">Moneymindspace.online</strong> performance.
                    </p>

                    {/* Highly convincing community benefits checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 text-[11px] text-white/50">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Receive instant staking & deposit event alerts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Share payment payout logs and withdrawal checks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Unlock special Telegram exclusive promo codes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Connect live with VIP partners & direct assistance</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 shrink-0 w-full lg:w-auto">
                    <a
                      href="https://t.me/moneymindonlineearningspace"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#24A1DE] via-[#229ED9] to-[#24A1DE] text-white font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-md shadow-[#24A1DE]/20 text-center cursor-pointer"
                    >
                      <span>Join Official Group</span>
                      <span className="font-mono text-[9px] bg-black/20 px-1.5 py-0.5 rounded">Group B</span>
                    </a>
                    
                    <p className="text-[8.5px] text-white/35 font-mono text-center">
                      Protected by Moneymindspace.online
                    </p>
                  </div>
                </div>
              </div>

              {/* Premium Customer Support & Help Desk Card */}
              <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 relative overflow-hidden mt-6 transition-all hover:border-sky-500/20">
                <div className="absolute top-0 right-0 p-3 text-sky-400/5 select-none pointer-events-none">
                  <HelpCircle className="w-16 h-16" />
                </div>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                  <div className="space-y-1.5 max-w-xl text-left">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[9px] uppercase font-bold tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                      Official Support Desk
                    </span>
                    <h3 className="text-sm font-semibold text-white tracking-wide">
                      Need help regarding your deposits, account ledger, or security reset?
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Our official customer care desk and compliance department verify transactions and support members around the clock. Connect with us via our official channel <strong className="text-sky-400">@MoneyMindSpaceSupport</strong> for updates, or email <strong className="text-[#D4AF37]">support@moneymindspace.online</strong> for direct security and ledger assistance.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 shrink-0 relative z-10">
                    <a
                      href="https://t.me/MoneyMindSpaceSupport"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500 text-white font-bold text-xs uppercase tracking-wider hover:bg-sky-400 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20"
                    >
                      <span>Support Chat</span>
                      <span className="font-mono text-[9px] bg-black/20 px-1 py-0.5 rounded">@MoneyMindSpaceSupport</span>
                    </a>
                    <a
                      href="mailto:support@moneymindspace.online"
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#8A6D3B] text-black font-extrabold text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-[#D4AF37]/10"
                    >
                      <span>Email Support</span>
                      <span className="font-mono text-[9px] bg-black/15 px-1 py-0.5 rounded">support@moneymindspace.online</span>
                    </a>
                  </div>
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
                {/* 1. DEPOSIT PORTAL - UPGRADED GLASSMORPHISM CARD WITH MULTI-RAIL PAKISTAN & CRYPTO SUPPORT */}
                <div 
                  id="deposit-section" 
                  className={`relative overflow-hidden rounded-3xl bg-gradient-to-b ${depositMethodTab === 'pakistan' ? 'from-[#031d10] via-[#010905] to-black border-2 border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_40px_rgba(16,185,129,0.15)] shadow-emerald-500/10' : 'from-[#0B0B0B] via-[#050505] to-black border-2 border-[#D4AF37]/45 hover:border-emerald-500/60 shadow-[0_0_40px_rgba(212,175,55,0.12)]'} hover:shadow-[0_0_55px_rgba(16,185,129,0.18)] transition-all duration-500 p-6 md:p-8 space-y-7 scroll-mt-24 backdrop-blur-xl`}
                >
                  {/* Premium color overlay gradients */}
                  <div className={`absolute top-0 right-0 w-72 h-72 bg-gradient-to-br ${depositMethodTab === 'pakistan' ? 'from-emerald-500/10 to-transparent' : 'from-[#D4AF37]/6 via-[#10B981]/3 to-transparent'} blur-3xl pointer-events-none`} />
                  <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/5 blur-3xl pointer-events-none" />

                  {/* Portal Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${depositMethodTab === 'pakistan' ? 'from-emerald-500/25 to-black border border-emerald-500/40' : 'from-[#D4AF37]/20 to-black border border-[#D4AF37]/40'} flex items-center justify-center ring-1 ring-white/5`}>
                        <span className="text-xl">{depositMethodTab === 'pakistan' ? '🇵🇰' : '💳'}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white leading-none">
                          {depositMethodTab === 'pakistan' ? 'Pakistan Deposit Center' : 'Deposit Portal'}
                        </h3>
                        <p className={`text-[8.5px] ${depositMethodTab === 'pakistan' ? 'text-emerald-400' : 'text-[#D4AF37]'} uppercase tracking-widest mt-1.5 font-mono font-bold animate-pulse`}>
                          {depositMethodTab === 'pakistan' ? 'PKR local rails active' : 'Crypto protocol active'}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`self-start sm:self-auto text-[8.5px] ${depositMethodTab === 'pakistan' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'} px-3 py-1.5 rounded-full uppercase tracking-widest font-black flex items-center gap-2`}>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      Verified Secure Core
                    </span>
                  </div>

                  {/* Live Available Balance Block / Description */}
                  {depositMethodTab === 'pakistan' ? (
                    <div className="bg-gradient-to-r from-emerald-950/20 via-white/[0.01] to-transparent p-5 rounded-2xl border border-white/5 relative">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#10B981] mb-2 flex items-center gap-1.5">
                        <span>🇵🇰 Instantly Secure Local Route</span>
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                      </p>
                      <p className="text-[11.5px] text-white/80 leading-relaxed font-sans">
                        Add funds to your account instantly and securely using available payment methods in Pakistan.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-white/[0.01] via-white/[0.02] to-transparent p-5 rounded-2xl border border-white/5 relative">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37] mb-2 flex items-center gap-1.5">
                        <span>💎 Official Smart Contract Node</span>
                        <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full"></span>
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-black text-white tracking-tight">
                          100% Instant
                        </span>
                        <span className="text-xs text-white/40 uppercase font-mono tracking-wider">
                          Auto-Credited Funds
                        </span>
                      </div>
                      <p className="text-[9.5px] text-emerald-400 mt-2 flex items-center gap-1 font-semibold">
                        <span>✅ Audited deposit addresses connected to our automated processing ledger.</span>
                      </p>
                    </div>
                  )}

                  {/* Custom Navigation Tab Toggle Bar */}
                  <div className="bg-black/60 border border-white/5 p-1 rounded-xl grid grid-cols-2 gap-1.5 shadow-inner shadow-black">
                    <button
                      type="button"
                      onClick={() => {
                        setDepositMethodTab('pakistan');
                        setPkDepError('');
                        setPkDepSuccess('');
                      }}
                      className={`py-2 px-3 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        depositMethodTab === 'pakistan'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      🇵🇰 Pakistan Center
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDepositMethodTab('crypto');
                        setDepError('');
                        setDepSuccess('');
                      }}
                      className={`py-2 px-3 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        depositMethodTab === 'crypto'
                          ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/25 shadow-sm'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      🌐 Crypto Deposits
                    </button>
                  </div>

                  {/* Divider */}
                  <div className={`w-full h-[1px] bg-gradient-to-r from-transparent ${depositMethodTab === 'pakistan' ? 'via-emerald-500/30' : 'via-[#D4AF37]/30'} to-transparent my-1`} />

                  {/* SUBTAB 1: PAKISTAN DEPOSIT PORTAL */}
                  {depositMethodTab === 'pakistan' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Available Deposit Method Title */}
                      <div className="space-y-2.5 text-left">
                        <label className="block text-[9px] font-black text-white/50 uppercase tracking-widest">Available Deposit Methods (Select One)</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Easypaisa */}
                          <div
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none cursor-pointer text-left border-2 bg-emerald-950/25 border-emerald-500`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">Easypaisa</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </div>

                          {/* JazzCash */}
                          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 opacity-60 select-none text-left flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚧</span>
                              <div>
                                <p className="font-bold text-white/70 leading-tight">JazzCash</p>
                                <p className="text-[8.5px] text-amber-500 uppercase tracking-widest font-extrabold mt-0.5">Soon</p>
                              </div>
                            </div>
                            <span className="text-[8px] border border-white/10 text-white/40 rounded py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </div>

                          {/* SadaPay */}
                          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 opacity-60 select-none text-left flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚧</span>
                              <div>
                                <p className="font-bold text-white/70 leading-tight">SadaPay</p>
                                <p className="text-[8.5px] text-amber-500 uppercase tracking-widest font-extrabold mt-0.5">Soon</p>
                              </div>
                            </div>
                            <span className="text-[8px] border border-white/10 text-white/40 rounded py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </div>

                          {/* NayaPay */}
                          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 opacity-60 select-none text-left flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚧</span>
                              <div>
                                <p className="font-bold text-white/70 leading-tight">NayaPay</p>
                                <p className="text-[8.5px] text-amber-500 uppercase tracking-widest font-extrabold mt-0.5">Soon</p>
                              </div>
                            </div>
                            <span className="text-[8px] border border-white/10 text-white/40 rounded py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </div>

                          {/* Bank Transfer */}
                          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 col-span-2 opacity-60 select-none text-left flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚧</span>
                              <div>
                                <p className="font-bold text-white/70 leading-tight">Bank Transfer</p>
                                <p className="text-[8.5px] text-amber-500 uppercase tracking-widest font-extrabold mt-0.5">Soon</p>
                              </div>
                            </div>
                            <span className="text-[8px] border border-white/10 text-white/40 rounded py-0.5 px-1.5 uppercase font-semibold">Local Bank</span>
                          </div>
                        </div>
                      </div>

                      {/* Display platform Easypaisa account number */}
                      <div className="bg-black/60 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left relative overflow-hidden">
                        <div className="space-y-1 z-10">
                          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Easypaisa Number</p>
                          <h5 className="text-[15px] font-mono font-black text-white tracking-widest">03435319202</h5>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyPkDepNumber}
                          className="w-full sm:w-auto px-4 py-2 shrink-0 text-[10px] tracking-widest uppercase font-black text-white bg-emerald-600 hover:bg-emerald-500 border-0 rounded-xl transition-all cursor-pointer font-sans z-10 shadow-lg shadow-emerald-700/20"
                        >
                          {copiedPkDepNumber ? 'COPIED ✅' : 'COPY NUMBER 📋'}
                        </button>
                      </div>

                      {/* Notice Box */}
                      <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-left text-xs leading-relaxed text-emerald-300">
                        📢 We are currently negotiating with payment agents in Pakistan to provide additional deposit options. More deposit methods will be available soon.
                      </div>

                      {/* Pakistan submission Form */}
                      <form onSubmit={handlePkDepositSubmit} className="space-y-4.5 text-left">
                        {/* Amount Box */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">💵</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Deposit Amount ({currency})</label>
                          </div>
                          <input
                            type="number"
                            placeholder={`Minimum ${currencySymbol}${Math.ceil(5 * conversionRate)}`}
                            value={pkDepAmount}
                            onChange={(e) => setPkDepAmount(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                            min="1"
                            step="any"
                          />
                          <p className="text-[9px] text-[#10B981] font-mono tracking-wider">
                            {currency === 'USD' ? (
                              `Approximate equivalent: ₨ ${(pkDepAmount ? parseFloat(pkDepAmount) * 280 : 1400).toFixed(2)} PKR`
                            ) : (
                              `Approximate equivalent: $ ${(pkDepAmount ? parseFloat(pkDepAmount) / conversionRate : 5).toFixed(2)} USD`
                            )}
                          </p>
                        </div>

                        {/* Your Sender Mobile/Account Number */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">📱</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Your Sender Easypaisa Account Number</label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. 03123456789"
                            value={pkDepSenderNumber}
                            onChange={(e) => setPkDepSenderNumber(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Your Sender Account Title / Name */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">👤</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Your Sender Account Title / Holder Name</label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. your name here"
                            value={pkDepSenderName}
                            onChange={(e) => setPkDepSenderName(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* TXID / Ref receipt Number */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">⛓</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Transaction ID (TXID) / Reference No.</label>
                          </div>
                          <input
                            type="text"
                            placeholder="Enter Easypaisa TXID / Receipt TRX ID"
                            value={pkDepTxid}
                            onChange={(e) => setPkDepTxid(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Important Notice Box */}
                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-left text-xs leading-relaxed text-amber-300 space-y-1.5">
                          <p className="font-extrabold flex items-center gap-1 text-amber-400">⚠️ IMPORTANT NOTICE</p>
                          <p>To ensure secure transactions and prevent fraud, all deposit payments are manually verified before being added to your account. Please send payment to the correct details and upload proof if required. Processing may take 2 minutes to 2 hours after verification.</p>
                        </div>

                        {/* Deposit Rules */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left space-y-2 text-xs">
                          <p className="font-black text-white uppercase tracking-wider text-[9px] text-[#10B981]">🇵🇰 Deposit Rules & requirements</p>
                          <ul className="space-y-1 text-white/70 list-disc list-inside">
                            <li>Minimum Deposit: {currencySymbol}{Math.ceil(5 * conversionRate)}</li>
                            <li>Processing Time: 2 Minutes to 2 Hours</li>
                            <li>One deposit request at a time</li>
                            <li>Always keep payment proof (screenshot/receipt)</li>
                          </ul>
                        </div>

                        {/* Alerts */}
                        {pkDepError && (
                          <p className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                            <span>{pkDepError}</span>
                          </p>
                        )}
                        {pkDepSuccess && (
                          <p className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
                            <span>{pkDepSuccess}</span>
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={submitting}
                          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 text-white shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_45px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-all duration-500 font-extrabold text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Processing Deposit...</span>
                            </>
                          ) : (
                            <>
                              <span>💰 Deposit Now</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* SUBTAB 2: CRYPTO DEPOSITS */}
                  {depositMethodTab === 'crypto' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Deposit Submission Form */}
                      <form onSubmit={handleDepositSubmit} className="space-y-5 text-left">
                        {/* Select Network */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🏦</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Select Network Token</label>
                          </div>
                          <select
                            value={depNetwork}
                            onChange={(e) => {
                              setDepNetwork(e.target.value);
                              setDepError('');
                              setDepSuccess('');
                            }}
                            className="w-full bg-black/80 border border-[#D4AF37]/30 hover:border-[#10B981]/60 focus:border-[#D4AF37] rounded-xl p-3.5 text-xs text-white uppercase font-black tracking-wider outline-none transition-all cursor-pointer shadow-inner shadow-black"
                          >
                            <option value="BNB">BNB (BEP20)</option>
                            <option value="TRX">USDT TRON (TRC20)</option>
                            <option value="MATIC">Polygon (MATIC)</option>
                          </select>
                        </div>

                        {/* Display Transfer Address block */}
                        <div className="space-y-1.5 bg-black/80 border border-[#D4AF37]/25 rounded-2xl p-4 relative overflow-hidden shadow-inner shadow-black">
                          <div className="flex items-center gap-1 md:gap-1.5 mb-1.5">
                            <span className="text-xs">🔑</span>
                            <p className="text-[9px] font-black text-[#D4AF37] uppercase tracking-[0.15em]">Official Safe Receiver Address</p>
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <span className="text-[11px] font-mono text-white/90 select-all break-all tracking-wider font-semibold">
                              {depositAddresses[depNetwork]}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyAddr(depNetwork, depositAddresses[depNetwork])}
                              className="px-4 py-2 shrink-0 text-[10px] tracking-widest uppercase font-black text-black bg-[#D4AF37] hover:brightness-110 border-0 rounded-xl transition-all cursor-pointer font-sans"
                            >
                              {copiedAddr === depNetwork ? 'COPIED ✅' : 'COPY ADDR 📋'}
                            </button>
                          </div>
                        </div>

                        {/* Amount Block */}
                        <div className="space-y-1.5 bg-transparent">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">💵</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Amount ({currencySymbol} Equiv.)</label>
                          </div>
                          <input
                            type="number"
                            placeholder={`Enter amount eg: ${(100 * conversionRate).toFixed(0)}`}
                            value={depAmount}
                            onChange={(e) => setDepAmount(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 select-all outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black"
                            min="1"
                            step="any"
                          />
                        </div>

                        {/* Tx Hash proof */}
                        <div className="space-y-1.5 bg-transparent">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">⛓</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Blockchain TXID / TxHash</label>
                          </div>
                          <input
                            type="text"
                            placeholder="Paste transaction receipt hash / TXID"
                            value={depTxHash}
                            onChange={(e) => setDepTxHash(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono placeholder-white/25 select-all outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black"
                          />
                        </div>

                        {/* Divider line style */}
                        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-transparent my-1" />

                        {/* Core metrics display */}
                        <div className="grid grid-cols-2 gap-3.5 pt-1 text-xs">
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 space-y-1">
                            <p className="text-[7.5px] text-white/40 uppercase tracking-widest font-black flex items-center gap-1">
                              <span>⏱</span> Verification Time
                            </p>
                            <p className="text-[10px] font-black text-emerald-400 font-mono">⏱ Est: 5-15 Minutes</p>
                          </div>
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 space-y-1">
                            <p className="text-[7.5px] text-white/40 uppercase tracking-widest font-black flex items-center gap-1">
                              <span>🔒</span> Core Safety
                            </p>
                            <p className="text-[10px] font-black text-[#D4AF37] font-mono">🔒 SSL Direct Escrow</p>
                          </div>
                        </div>

                        {/* Status feedback alerts */}
                        {depError && (
                          <p className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                            <span>⚠️ Error:</span>
                            <span>{depError}</span>
                          </p>
                        )}
                        {depSuccess && (
                          <p className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
                            <span>✅ Success:</span>
                            <span>{depSuccess}</span>
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={submitting}
                          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] bg-[length:200%_auto] hover:bg-right text-black shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:shadow-[0_0_45px_rgba(212,175,55,0.6)] active:scale-[0.98] transition-all duration-500 font-black text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-black" />
                              <span>Routing Proof...</span>
                            </>
                          ) : (
                            <>
                              <span>🚀 Submit Deposit Proof</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </div>

                {/* 2. WITHDRAW PORTAL - UPGRADED WITH MULTI-RAIL PAKISTAN & CRYPTO SUPPORT */}
                <div 
                  id="withdraw-section" 
                  className={`relative overflow-hidden rounded-3xl bg-gradient-to-b ${withdrawMethodTab === 'pakistan' ? 'from-[#031d10] via-[#010905] to-black border-2 border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_40px_rgba(16,185,129,0.15)]' : 'from-[#0B0B0B] via-[#050505] to-black border-2 border-[#D4AF37]/45 hover:border-emerald-500/60 shadow-[0_0_40px_rgba(212,175,55,0.12)]'} hover:shadow-[0_0_55px_rgba(16,185,129,0.18)] transition-all duration-500 p-6 md:p-8 space-y-7 scroll-mt-24 backdrop-blur-xl`}
                >
                  {/* Premium color overlay gradients */}
                  <div className={`absolute top-0 right-0 w-72 h-72 bg-gradient-to-br ${withdrawMethodTab === 'pakistan' ? 'from-emerald-500/10 to-transparent' : 'from-[#D4AF37]/6 via-[#10B981]/3 to-transparent'} blur-3xl pointer-events-none`} />
                  <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/5 blur-3xl pointer-events-none" />

                  {/* Portal Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${withdrawMethodTab === 'pakistan' ? 'from-emerald-500/25 to-black border border-emerald-500/40' : 'from-[#D4AF37]/20 to-black border border-[#D4AF37]/40'} flex items-center justify-center ring-1 ring-white/5`}>
                        <span className="text-xl">{withdrawMethodTab === 'pakistan' ? '🇵🇰' : '💰'}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white leading-none">Withdrawal Gateway</h3>
                        <p className={`text-[8.5px] ${withdrawMethodTab === 'pakistan' ? 'text-emerald-400' : 'text-[#D4AF37]'} uppercase tracking-widest mt-1.5 font-mono font-bold animate-pulse`}>
                          {withdrawMethodTab === 'pakistan' ? 'PKR local rails active' : 'Crypto protocol active'}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`self-start sm:self-auto text-[8.5px] ${withdrawMethodTab === 'pakistan' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'} px-3 py-1.5 rounded-full uppercase tracking-widest font-black flex items-center gap-2`}>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      Verified Secure Core
                    </span>
                  </div>

                  {/* 💰 Live Available Balance Block */}
                  <div className={`bg-gradient-to-r ${withdrawMethodTab === 'pakistan' ? 'from-emerald-950/20 via-white/[0.01]' : 'from-white/[0.01] via-white/[0.02]'} to-transparent p-5 rounded-2xl border border-white/5 relative`}>
                    <p className={`text-[9.5px] font-black uppercase tracking-[0.2em] ${withdrawMethodTab === 'pakistan' ? 'text-emerald-400' : 'text-[#D4AF37]'} mb-2 flex items-center gap-1.5`}>
                      <span>💰 Available balance</span>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-mono font-black text-white tracking-tight">
                        {currencySymbol}{(balance * conversionRate).toFixed(2)}
                      </span>
                      <span className="text-xs text-white/40 uppercase font-mono tracking-wider">
                        ({currency}) Base Liquidity
                      </span>
                    </div>
                    <p className="text-[9.5px] text-emerald-400 mt-2 flex items-center gap-1 font-semibold">
                      <span>✅ Safely secured under high-performance cryptographic locks.</span>
                    </p>
                  </div>

                  {/* Custom Navigation Tab Toggle Bar */}
                  <div className="bg-black/60 border border-white/5 p-1 rounded-xl grid grid-cols-2 gap-1.5 shadow-inner shadow-black">
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawMethodTab('pakistan');
                        setPkWithdrawError('');
                        setPkWithdrawSuccess('');
                      }}
                      className={`py-2 px-3 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        withdrawMethodTab === 'pakistan'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      🇵🇰 Pakistan Center
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawMethodTab('crypto');
                        setWithdrawError('');
                        setWithdrawSuccess('');
                      }}
                      className={`py-2 px-3 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        withdrawMethodTab === 'crypto'
                          ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/25 shadow-sm'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      🌐 Crypto Payouts
                    </button>
                  </div>

                  {/* Divider */}
                  <div className={`w-full h-[1px] bg-gradient-to-r from-transparent ${withdrawMethodTab === 'pakistan' ? 'via-emerald-500/30' : 'via-[#D4AF37]/30'} to-transparent my-1`} />

                  {/* SUBTAB 1: PAKISTAN WITHDRAWAL CENTER */}
                  {withdrawMethodTab === 'pakistan' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Section Title & Description */}
                      <div className="text-left space-y-1.5">
                        <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                          <span>🇵🇰</span> Pakistan Withdrawal Center
                        </h4>
                        <p className="text-[11.5px] text-white/60 leading-relaxed font-sans">
                          Withdraw your earnings safely and quickly through our available payment methods in Pakistan.
                        </p>
                      </div>

                      {/* Payment Methods Grid */}
                      <div className="space-y-2.5 text-left">
                        <label className="block text-[9px] font-black text-white/50 uppercase tracking-widest">Available Withdrawal Methods (Select One)</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Easypaisa */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('EASYPAISA');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'EASYPAISA' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-black/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">Easypaisa</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </button>

                          {/* JazzCash */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('JAZZCASH');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'JAZZCASH' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-black/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">JazzCash</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </button>

                          {/* SadaPay */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('SADAPAY');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'SADAPAY' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-black/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">SadaPay</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </button>

                          {/* NayaPay */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('NAYAPAY');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'NAYAPAY' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-black/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">NayaPay</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </button>

                          {/* Bank Transfer */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('BANK');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between col-span-2 select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'BANK' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-black/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🏛️</span>
                              <div>
                                <p className="font-bold text-white leading-tight">Bank Transfer</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">Local Bank</span>
                          </button>
                        </div>
                      </div>

                      {/* Pakistan submission form */}
                      <form onSubmit={handlePkWithdrawSubmit} className="space-y-4 text-left">
                        {/* Selected local account key details (Number/IBAN) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">📱</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                              {pkMethod === 'BANK' ? 'Bank Account Number / IBAN' : `${pkMethod === 'EASYPAISA' ? 'Easypaisa' : pkMethod === 'JAZZCASH' ? 'JazzCash' : pkMethod === 'SADAPAY' ? 'SadaPay' : 'NayaPay'} Account Number`}
                            </label>
                          </div>
                          <input
                            type="text"
                            placeholder={pkMethod === 'BANK' ? 'e.g. PK00UNTY0000000000000000' : 'e.g. 03123456789'}
                            value={pkWithdrawNumber}
                            onChange={(e) => setPkWithdrawNumber(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Selected local account title name */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">👤</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                              {pkMethod === 'BANK' ? 'Account Title / Holder Name' : `Your ${pkMethod === 'EASYPAISA' ? 'Easypaisa' : pkMethod === 'JAZZCASH' ? 'JazzCash' : pkMethod === 'SADAPAY' ? 'SadaPay' : 'NayaPay'} Account Title/Name`}
                            </label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. your name here"
                            value={pkWithdrawName}
                            onChange={(e) => setPkWithdrawName(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Amount Box */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">💵</span>
                              <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Amount to Withdraw ({currency})</label>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPkWithdrawAmount((balance * conversionRate).toFixed(2))}
                              className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider hover:underline hover:text-white transition-all"
                            >
                              Max Avail: {currencySymbol}{(balance * conversionRate).toFixed(2)}
                            </button>
                          </div>
                          <input
                            type="number"
                            placeholder={`Min ${currencySymbol}${Math.ceil(10 * conversionRate)}`}
                            value={pkWithdrawAmount}
                            onChange={(e) => setPkWithdrawAmount(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                            step="any"
                          />
                          {parseFloat(pkWithdrawAmount) > 0 && (
                            <p className="text-[10px] text-emerald-400 font-bold font-mono">
                              💸 Approx equivalent: {currency === 'USD' ? `₨ ${(parseFloat(pkWithdrawAmount) * 280).toFixed(0)} PKR` : `$ ${(parseFloat(pkWithdrawAmount) / conversionRate).toFixed(2)} USD`} (at current rate)
                            </p>
                          )}
                        </div>

                        {/* Notice Box */}
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-left text-xs leading-relaxed text-emerald-300">
                          📢 All local payment networks in Pakistan are fully active and synchronized. Enter your account details correctly to initiate direct local clearing agent routing.
                        </div>

                        {/* Important Notice Box */}
                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-left text-xs leading-relaxed text-amber-300">
                          ⚠️ To ensure secure transactions and prevent fraudulent activity, all withdrawal requests are manually reviewed before processing. Please make sure your payment details are correct. Processing may take 2–24 hours after approval.
                        </div>

                        {/* Withdrawal Rules */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-left text-xs space-y-1 text-white/75 font-sans leading-relaxed">
                          <p className="font-bold text-white text-[10px] uppercase tracking-widest mb-1 font-sans">Withdrawal Rules:</p>
                          <p className="flex items-center gap-2">• Minimum Withdrawal: {currencySymbol}{Math.ceil(10 * conversionRate)}</p>
                          <p className="flex items-center gap-2">• Processing Time: 2–24 Hours</p>
                          <p className="flex items-center gap-2">• One withdrawal request at a time</p>
                          <p className="flex items-center gap-2">• Ensure payment details are correct before submitting</p>
                        </div>

                        {/* Status feedback alerts */}
                        {pkWithdrawError && (
                          <div className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg select-all">
                            <span>{pkWithdrawError}</span>
                          </div>
                        )}
                        {pkWithdrawSuccess && (
                          <div className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
                            <span>{pkWithdrawSuccess}</span>
                          </div>
                        )}

                        {/* Large "Withdraw Now" button */}
                        <button
                          type="submit"
                          disabled={submitting}
                          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 bg-[length:200%_auto] hover:bg-right text-white shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_45px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-all duration-500 font-black text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Routing Request...</span>
                            </>
                          ) : (
                            <>
                              <span>💸 Withdraw Now</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* SUBTAB 2: GENERAL CRYPTO PORTAL */}
                  {withdrawMethodTab === 'crypto' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-5"
                    >
                      <form onSubmit={handleWithdrawSubmit} className="space-y-5 text-left">
                        {/* Method Dropdown selection */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🏦</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Withdraw To</label>
                          </div>
                          <select
                            value={withdrawNetwork}
                            onChange={(e) => {
                              setWithdrawNetwork(e.target.value);
                              setWithdrawError('');
                              setWithdrawSuccess('');
                            }}
                            className="w-full bg-black/80 border border-[#D4AF37]/30 hover:border-[#10B981]/60 focus:border-[#D4AF37] rounded-xl p-3.5 text-xs text-white uppercase font-black tracking-wider outline-none transition-all cursor-pointer shadow-inner shadow-black"
                          >
                            <option value="BNB">Binance BNB (BEP20)</option>
                            <option value="TRX">Binance USDT (TRC20)</option>
                            <option value="MATIC">Binance Polygon (MATIC)</option>
                          </select>
                        </div>

                        {/* Target Address input */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">📱</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                              Destination Wallet Address / Binance Pay ID
                            </label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g., Binance Pay ID or BEP20 Wallet Address"
                            value={withdrawWallet}
                            onChange={(e) => setWithdrawWallet(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono placeholder-white/25 select-all outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black"
                          />
                        </div>

                        {/* Value Amount input */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-sans">💵</span>
                              <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Amount to Withdraw ({currencySymbol})</label>
                            </div>
                            <button
                              type="button"
                              onClick={() => setWithdrawAmount((balance * conversionRate).toFixed(2))}
                              className="text-[9px] font-extrabold text-[#D4AF37] uppercase tracking-wider hover:underline hover:text-[#10B981] transition-all"
                            >
                              Max Avail: {currencySymbol}{(balance * conversionRate).toFixed(2)}
                            </button>
                          </div>
                          <input
                            type="number"
                            placeholder="$0.00 equivalent value"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 select-all outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black"
                            step="any"
                          />
                        </div>

                        {/* Divider line style */}
                        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-transparent my-1" />

                        {/* Core metrics display */}
                        <div className="grid grid-cols-2 gap-3.5 pt-1 text-xs">
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 space-y-1">
                            <p className="text-[7.5px] text-white/40 uppercase tracking-widest font-black flex items-center gap-1">
                              <span>⚡</span> Instant Withdrawal
                            </p>
                            <p className="text-[10px] font-black text-emerald-400 font-mono">⏱ Processing: 1-2 Minutes</p>
                          </div>
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 space-y-1">
                            <p className="text-[7.5px] text-white/40 uppercase tracking-widest font-black flex items-center gap-1">
                              <span>🔒</span> Secure Gateway
                            </p>
                            <p className="text-[10px] font-black text-[#D4AF37] font-mono">✅ Min Withdraw: $1.00</p>
                          </div>
                        </div>

                        {/* Status Feedback alerts */}
                        {withdrawError && (
                          <p className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                            <span>⚠️ Error:</span>
                            <span>{withdrawError}</span>
                          </p>
                        )}
                        {withdrawSuccess && (
                          <p className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
                            <span>✅ Success:</span>
                            <span>{withdrawSuccess}</span>
                          </p>
                        )}

                        {/* Gold Glowing Core Button with Custom hover scale & glow tracking */}
                        <button
                          type="submit"
                          disabled={submitting}
                          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] bg-[length:200%_auto] hover:bg-right text-black shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:shadow-[0_0_45px_rgba(212,175,55,0.6)] active:scale-[0.98] transition-all duration-500 font-black text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-black" />
                              <span>Routing Request...</span>
                            </>
                          ) : (
                            <>
                              <span>🚀 Withdraw Now</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </div>

                {/* 🔒 CERTIFIED TRUST SECTION */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#090909] border border-[#D4AF37]/15 text-left space-y-1">
                    <span className="text-[#D4AF37] text-md">⚡</span>
                    <h5 className="text-[9px] font-black uppercase text-white tracking-widest">Fast Automated</h5>
                    <p className="text-[7.5px] text-white/50 uppercase tracking-widest leading-none font-bold">Direct Withdrawals</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#090909] border border-[#D4AF37]/15 text-left space-y-1">
                    <span className="text-emerald-400 text-md">💸</span>
                    <h5 className="text-[9px] font-black uppercase text-white tracking-widest">24/7 Processing</h5>
                    <p className="text-[7.5px] text-white/50 uppercase tracking-widest leading-none font-bold">Uninterrupted Yields</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#090909] border border-[#D4AF37]/15 text-left space-y-1">
                    <span className="text-emerald-500 text-md">🔒</span>
                    <h5 className="text-[9px] font-black uppercase text-white tracking-widest">100% Secure</h5>
                    <p className="text-[7.5px] text-white/50 uppercase tracking-widest leading-none font-bold">Encrypted Ledger</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#090909] border border-[#D4AF37]/15 text-left space-y-1">
                    <span className="text-[#D4AF37] text-md">📱</span>
                    <h5 className="text-[9px] font-black uppercase text-white tracking-widest">Easy/Jazz/Binance</h5>
                    <p className="text-[7.5px] text-white/50 uppercase tracking-widest leading-none font-bold">Standard Channels</p>
                  </div>
                </div>
              </div>

              {/* 🏆 LATEST WITHDRAWALS (TRUST PROOF SECTION) */}
              <div className="bg-[#0B0B0B] border border-white/5 rounded-2xl p-6 space-y-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🏆</span>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#D4AF37]">Latest Withdrawals</h4>
                      <p className="text-[8px] text-[#10B981] uppercase tracking-wider font-bold animate-pulse mt-0.5">Real-time Platform Payouts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] text-[7.5px] uppercase font-black border border-[#10B981]/20">
                    <span className="w-1 h-1 bg-[#10B981] rounded-full animate-ping"></span>
                    <span>Verified</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#050505]">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-white/[0.01] border-b border-white/5 text-white/30 uppercase text-[8px] tracking-widest">
                        <th className="py-3 px-4 font-bold">User</th>
                        <th className="py-3 px-4 font-bold">Amount</th>
                        <th className="py-3 px-4 font-bold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {[
                        { name: "A*** Khan", amount: "$50", method: "EasyPaisa", time: "Just now" },
                        { name: "M*** Ali", amount: "$20", method: "JazzCash", time: "1 min ago" },
                        { name: "B*** Crypto", amount: "$130", method: "Binance", time: "5 mins ago" },
                        { name: "S*** Ahmed", amount: "$85", method: "EasyPaisa", time: "12 mins ago" },
                        { name: "Z*** Malik", amount: "$30", method: "JazzCash", time: "18 mins ago" }
                      ].map((item, idx) => (
                        <motion.tr 
                          key={idx} 
                          initial={{ opacity: 0, y: 15 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-10px" }}
                          transition={{ duration: 0.4, delay: idx * 0.05 }}
                          className="hover:bg-white/[0.01] transition-all"
                        >
                          <td className="py-3 px-4 font-medium text-white/90">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                              <span>{item.name}</span>
                              <span className="text-[7px] text-white/30 uppercase px-1.5 py-0.5 rounded border border-white/5 bg-white/[0.01]">{item.method}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#D4AF37]">{item.amount}</td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center gap-1 text-[8.5px] text-[#10B981] font-black uppercase tracking-wider bg-[#10B981]/10 border border-[#10B981]/20 px-2.5 py-1 rounded">
                              ✅ Paid
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. FUNDING STATEMENT LEDGER */}
              <div className="bg-[#0B0B0B] border border-white/5 rounded-2xl p-6 space-y-4">
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
                            {paginatedDeposits.map((dep, idx) => (
                              <motion.tr 
                                key={dep.id} 
                                initial={{ opacity: 0, y: 15 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-10px" }}
                                transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.3) }}
                                className="text-white/80"
                              >
                                <td className="py-2.5 text-[10px] font-mono text-white/40">{dep.timestamp}</td>
                                <td className="py-2.5 font-bold uppercase text-white">{dep.network}</td>
                                <td className="py-2.5 font-medium text-[#D4AF37]">{currencySymbol}{(dep.amount * conversionRate).toFixed(2)}</td>
                                <td className="py-2.5 font-mono text-white/40 text-[9px] truncate max-w-[120px]" title={dep.txHash}>{dep.txHash}</td>
                                <td className="py-2.5 text-right">
                                  <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-1">
                                      {dep.status === 'pending' && (
                                        <span className="inline-flex items-center gap-1 text-amber-500 font-bold uppercase tracking-wider text-[9px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                          <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                          Pending Validation
                                        </span>
                                      )}
                                      {dep.status === 'approved' && (
                                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold uppercase tracking-wider text-[9px] bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-md">
                                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                                          Approved
                                        </span>
                                      )}
                                      {dep.status === 'rejected' && (
                                        <span className="inline-flex items-center gap-1 text-rose-500 font-bold uppercase tracking-wider text-[9px] bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                                          <XCircle className="w-3 h-3 text-rose-500" />
                                          Rejected
                                        </span>
                                      )}
                                    </div>
                                    {dep.status === 'pending' && (
                                      <div className="w-24 sm:w-28 bg-white/5 h-1 rounded-full overflow-hidden relative">
                                        <motion.div 
                                          className="bg-[#D4AF37] h-full rounded-full"
                                          initial={{ x: '-100%' }}
                                          animate={{ x: '100%' }}
                                          transition={{ 
                                            repeat: Infinity, 
                                            duration: 1.5, 
                                            ease: "linear" 
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>

                        {totalDepositsPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                            <button
                              disabled={depositsPage === 1}
                              onClick={() => setDepositsPage(prev => Math.max(prev - 1, 1))}
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02] disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" /> Prev
                            </button>
                            <span className="text-[10px] text-white/50 font-mono">
                              Page {depositsPage} of {totalDepositsPages}
                            </span>
                            <button
                              disabled={depositsPage === totalDepositsPages}
                              onClick={() => setDepositsPage(prev => Math.min(prev + 1, totalDepositsPages))}
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02] disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Next <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <hr className="border-white/5" />

                  {/* Upgraded Withdrawals History - Transformed to chronological cards with green success indicators per design requirements */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📥</span>
                        <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest leading-none">My Payout Records (Chronological Cards)</p>
                      </div>
                      <span className="text-[7.5px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Secure SSL Gateway Live
                      </span>
                    </div>

                    {(!withdrawals || withdrawals.length === 0) ? (
                      <div className="p-8 bg-[#050505] border border-dashed border-white/5 rounded-xl text-center text-[10px] text-white/30 uppercase tracking-widest">
                        No payout withdrawal payouts logged yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {paginatedWithdrawals.map((wit, idx) => {
                          const isApproved = wit.status === 'approved';
                          const isPending = wit.status === 'pending';
                          return (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true, margin: "-20px" }}
                              transition={{ duration: 0.5, delay: Math.min(idx * 0.05, 0.3) }}
                              whileHover={{ scale: 1.015, borderColor: isApproved ? 'rgba(16,185,129,0.3)' : 'rgba(212,175,55,0.2)' }}
                              key={wit.id} 
                              className={`p-4 rounded-xl border transition-all duration-300 backdrop-blur-md relative overflow-hidden ${
                                isApproved 
                                  ? 'bg-[#10B981]/5 border-[#10B981]/20 shadow-[0_4px_20px_rgba(16,185,129,0.04)]' 
                                  : isPending 
                                  ? 'bg-amber-500/5 border-amber-500/15' 
                                  : 'bg-rose-500/5 border-rose-500/15'
                              }`}
                            >
                              {/* Glowing success or pending corner flare */}
                              <div className={`absolute top-0 right-0 w-24 h-24 blur-2xl pointer-events-none opacity-40 ${
                                isApproved ? 'bg-[#10B981]/20' : 'bg-[#D4AF37]/10'
                              }`} />

                              <div className="flex flex-col justify-between h-full space-y-3 relative z-10 text-left">
                                <div className="flex items-center justify-between">
                                  <span className={`inline-flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                                    isApproved 
                                      ? 'text-emerald-400 bg-emerald-400/15 border-emerald-400/20' 
                                      : isPending 
                                      ? 'text-amber-400 bg-amber-400/15 border-amber-400/20 animate-pulse'
                                      : 'text-rose-400 bg-rose-500/15 border-rose-500/20'
                                  }`}>
                                    {isApproved ? '✅ Withdrawal Completed' : isPending ? '⏳ Processing Request' : '❌ Withdrawal Rejected'}
                                  </span>
                                  <span className="text-[9px] font-mono text-white/30 font-semibold">{wit.timestamp}</span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-lg md:text-xl font-mono font-black text-white tracking-tight">
                                      {currencySymbol}{(wit.amount * conversionRate).toFixed(2)}
                                    </span>
                                    <span className="text-white/30 text-xs">→</span>
                                    <span className="text-xs font-black uppercase text-[#D4AF37] tracking-wider">
                                      {wit.network}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-white/40 font-mono truncate max-w-xs" title={wit.wallet}>
                                    <span className="text-white/20 select-none">ID/Acc: </span>
                                    {wit.wallet}
                                  </p>
                                </div>

                                {/* Visual Progress Step Tracker Pipeline */}
                                <div className="pt-4 border-t border-white/5 mt-2.5">
                                  <p className="text-[8px] font-black uppercase text-white/40 tracking-widest mb-3 flex items-center justify-between">
                                    <span>🔍 Payout Track Pipeline</span>
                                    {isPending && <span className="text-amber-400 font-mono text-[7px] animate-pulse">Under Review (2–24h)</span>}
                                    {isApproved && <span className="text-emerald-400 font-mono text-[7px]">Processed & Disbursed</span>}
                                    {wit.status === 'rejected' && <span className="text-rose-400 font-mono text-[7px]">Audit Rejected</span>}
                                  </p>
                                  
                                  <div className="relative flex items-center justify-between px-1.5">
                                    {/* Line connector underneath */}
                                    <div className="absolute left-3 right-3 top-[7px] h-[2px] bg-white/5 -z-10" />
                                    {/* Active transition fill line */}
                                    <div 
                                      className={`absolute left-3 top-[7px] h-[2px] transition-all duration-700 -z-10 ${
                                        isApproved ? 'bg-emerald-500 w-[calc(100%-1.5rem)]' : 
                                        wit.status === 'rejected' ? 'bg-rose-500 w-[calc(100%-1.5rem)]' :
                                        'bg-amber-500/60 w-[calc(50%-0.75rem)] animate-pulse'
                                      }`}
                                    />

                                    {/* Step 1: Pending (Always Submitted successfully) */}
                                    <div className="flex flex-col items-center gap-1.5 text-center">
                                      <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-[7.5px] text-emerald-400 font-black relative shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                                        ✓
                                      </div>
                                      <span className="text-[7px] font-black uppercase tracking-wider text-emerald-400">Pending</span>
                                    </div>

                                    {/* Step 2: Under Review */}
                                    <div className="flex flex-col items-center gap-1.5 text-center">
                                      <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[7.5px] font-black relative transition-all duration-300 ${
                                        isApproved || wit.status === 'rejected'
                                          ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                                          : 'bg-amber-500/20 border border-amber-500 text-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                      }`}>
                                        {(isApproved || wit.status === 'rejected') ? '✓' : '•'}
                                      </div>
                                      <span className={`text-[7px] font-black uppercase tracking-wider ${
                                        isApproved || wit.status === 'rejected' ? 'text-emerald-400/80' : 'text-amber-400'
                                      }`}>Under Review</span>
                                    </div>

                                    {/* Step 3: Approved / Paid */}
                                    <div className="flex flex-col items-center gap-1.5 text-center">
                                      <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[7.5px] font-black relative transition-all duration-300 ${
                                        isApproved
                                          ? 'bg-emerald-500 border border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                          : wit.status === 'rejected'
                                          ? 'bg-rose-500 border border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                                          : 'bg-white/5 border border-white/10 text-white/30'
                                      }`}>
                                        {isApproved ? '✓' : wit.status === 'rejected' ? '✗' : '3'}
                                      </div>
                                      <span className={`text-[7px] font-black uppercase tracking-wider ${
                                        isApproved ? 'text-emerald-400 font-bold' : wit.status === 'rejected' ? 'text-rose-400 font-bold' : 'text-white/30'
                                      }`}>{wit.status === 'rejected' ? 'Rejected' : 'Approved'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}

                        {totalWithdrawalsPages > 1 && (
                          <div className="col-span-1 md:col-span-2 flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                            <button
                              disabled={withdrawalsPage === 1}
                              onClick={() => setWithdrawalsPage(prev => Math.max(prev - 1, 1))}
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02] disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" /> Prev
                            </button>
                            <span className="text-[10px] text-white/50 font-mono">
                              Page {withdrawalsPage} of {totalWithdrawalsPages}
                            </span>
                            <button
                              disabled={withdrawalsPage === totalWithdrawalsPages}
                              onClick={() => setWithdrawalsPage(prev => Math.min(prev + 1, totalWithdrawalsPages))}
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02] disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Next <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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

      {/* 🚀 HIGH-FIDELITY TIKTOK / YOUTUBE FRIENDLY POPUP WITH SIMULATED VERIFICATION */}
      <AnimatePresence>
        {recentSuccessWithdraw && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-[#111111] to-black border-2 border-[#10B981]/40 hover:border-[#D4AF37]/50 shadow-[0_0_80px_rgba(16,185,129,0.25)] p-6 md:p-8 space-y-6 text-center"
            >
              {/* Golden circular glow background effect */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#10B981]/15 to-[#D4AF37]/5 blur-3xl pointer-events-none" />
              
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#10B981]/20 to-[#D4AF37]/15 flex items-center justify-center border-2 border-[#10B981]/50 relative">
                  {successStep === 'completed' ? (
                    <motion.span 
                      initial={{ scale: 0.5, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="text-3xl"
                    >
                      🎉
                    </motion.span>
                  ) : (
                    <RefreshCw className="w-7 h-7 text-[#10B981] animate-spin" />
                  )}
                  {successStep === 'completed' && (
                    <span className="absolute -top-1.5 -right-1.5 text-xs bg-[#10B981] text-black font-black uppercase px-1.5 py-0.5 rounded-full">
                      LIVE
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black uppercase tracking-wider text-white">
                    {successStep === 'completed' ? '🎉 Withdrawal Successful' : '⚡ Submitting Real-time Request'}
                  </h3>
                  <p className="text-xs text-white/50 tracking-wider">
                    High-Seed Automatic Routing Protocol
                  </p>
                </div>
              </div>

              {/* Glassmorphic payout confirmation values */}
              <div className="p-5 rounded-2xl bg-[#080808]/80 border border-white/5 space-y-3">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Transaction Value Dispatched</p>
                <h4 className="text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-[#D4AF37] to-emerald-400 bg-size-[200%_auto] tracking-tight">
                  {currencySymbol}{(recentSuccessWithdraw.amount * conversionRate).toFixed(2)}
                </h4>
                <div className="h-[1px] bg-white/5" />
                <div className="grid grid-cols-2 gap-2 text-left">
                  <div>
                    <span className="text-[8px] text-white/30 uppercase tracking-widest block font-bold">Network/Type</span>
                    <span className="text-[11px] font-black text-white uppercase tracking-wider block mt-0.5">{recentSuccessWithdraw.network}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 uppercase tracking-widest block font-bold">Payout Target</span>
                    <span className="text-[11px] font-mono font-medium text-[#D4AF37] block mt-0.5 truncate select-all" title={recentSuccessWithdraw.wallet}>
                      {recentSuccessWithdraw.wallet}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar and simulated auditing output */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-xs font-mono font-extrabold text-white">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">
                    {successStep === 'completed' ? '✅ Dispatch Completed' : '⚡ Routing Ledger Verify'}
                  </span>
                  <span className="text-emerald-400">{successProgress}%</span>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/15 relative">
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: `${successProgress}%` }}
                    className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#10B981] via-[#D4AF37] to-[#10B981] bg-[length:200%_auto] rounded-full"
                  />
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${successStep === 'completed' ? 'bg-[#10B981] animate-pulse' : 'bg-amber-500 animate-ping'}`} />
                  <span className="text-[9.5px] font-mono text-white/60 tracking-wider">
                    {successStep === 'completed' 
                      ? '✅ Completed: Sent to ' + recentSuccessWithdraw.network 
                      : 'Syncing with Multi-Auditor Cryptographic Protocol...'
                    }
                  </span>
                </div>
              </div>

              {/* Close Button Trigger */}
              {successStep === 'completed' && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setRecentSuccessWithdraw(null)}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-black font-black text-xs uppercase tracking-widest cursor-pointer hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                >
                  <span>🚀 Continue Earning</span>
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
