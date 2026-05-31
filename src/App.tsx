/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  doc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  getDoc, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  getDocFromServer,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { UserProfile, ReferralLog, DepositLog, WithdrawalLog } from './types';
import RegistrationCard from './components/RegistrationCard';
import DashboardCard from './components/DashboardCard';
import ReferralHistory from './components/ReferralHistory';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarIcon, getAvatarConfig } from './lib/avatars';
import earnhubLogo from './assets/images/earnhub_logo_1780161493423.png';
import { playSound } from './lib/sounds';


export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<ReferralLog[]>([]);
  const [deposits, setDeposits] = useState<DepositLog[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalLog[]>([]);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [referredSource, setReferredSource] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);

  // Load and manage simulated days offset
  const [virtualDays, setVirtualDays] = useState<number>(0);

  useEffect(() => {
    if (currentUid) {
      const saved = localStorage.getItem(`earnhub_virtual_days_${currentUid}`);
      setVirtualDays(saved ? Number(saved) : 0);
    } else {
      setVirtualDays(0);
    }
  }, [currentUid]);

  // Validate the Firestore connection when the application initially boots as required by guidelines
  useEffect(() => {
    async function testConnection() {
      try {
        await getDoc(doc(db, 'test', 'connection'));
      } catch (error) {
        console.warn("Firestore connection check info:", error);
      }
    }
    testConnection();
  }, []);

  // Toast Notification System
  const [toasts, setToasts] = useState<{id: string; message: string; type: 'success' | 'error'}[]>([]);
  const addToast = (
    message: string, 
    type: 'success' | 'error', 
    sound?: 'deposit_submitted' | 'withdrawal_approved' | 'new_referral'
  ) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);

    // Trigger Web Audio API synthesized sound
    if (sound) {
      playSound(sound);
    } else {
      // Inline automatic detection based on message text
      const msgLower = message.toLowerCase();
      if (msgLower.includes('deposit') && (msgLower.includes('submit') || msgLower.includes('validation') || msgLower.includes('proof'))) {
        playSound('deposit_submitted');
      } else if (msgLower.includes('withdrawal') && (msgLower.includes('approve') || msgLower.includes('dispatched') || msgLower.includes('processed'))) {
        playSound('withdrawal_approved');
      } else if (msgLower.includes('referral') || msgLower.includes('partner') || msgLower.includes('onboard')) {
        playSound('new_referral');
      }
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const prevDepositsRef = useRef<DepositLog[]>([]);
  const prevWithdrawalsRef = useRef<WithdrawalLog[]>([]);

  useEffect(() => {
    if (prevDepositsRef.current.length > 0) {
      deposits.forEach(newDep => {
        const oldDep = prevDepositsRef.current.find(d => d.id === newDep.id);
        if (oldDep && oldDep.status === 'pending') {
          if (newDep.status === 'approved') addToast(`Your deposit of $${newDep.amount} was approved!`, 'success');
          if (newDep.status === 'rejected') addToast(`Your deposit of $${newDep.amount} was rejected.`, 'error');
        }
      });
    }
    prevDepositsRef.current = deposits;
  }, [deposits]);

  useEffect(() => {
    if (prevWithdrawalsRef.current.length > 0) {
      withdrawals.forEach(newWit => {
        const oldWit = prevWithdrawalsRef.current.find(w => w.id === newWit.id);
        if (oldWit && oldWit.status === 'pending') {
          if (newWit.status === 'approved') addToast(`Your withdrawal of $${newWit.amount} was approved!`, 'success', 'withdrawal_approved');
          if (newWit.status === 'rejected') addToast(`Your withdrawal of $${newWit.amount} was rejected.`, 'error');
        }
      });
    }
    prevWithdrawalsRef.current = withdrawals;
  }, [withdrawals]);

  // Synchronize with genuine custom authentication session
  useEffect(() => {
    const storedUid = localStorage.getItem('earnhub_logged_in_uid');
    if (storedUid) {
      setCurrentUid(storedUid);
    } else {
      setCurrentUid(null);
      setUserProfile(null);
      setLoading(false);
    }
  }, []);

  // Set up real-time Firestore synchronization once currentUid is resolved
  useEffect(() => {
    if (!currentUid) return;

    // Real-time user profile listener
    const userRef = doc(db, 'users', currentUid);
    const unsubUserProfile = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserProfile({
          userId: data.userId,
          name: data.name,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          avatar: data.avatar,
          signupBonus: data.signupBonus,
          lastClaimedAt: data.lastClaimedAt,
          claimStreak: data.claimStreak,
          dailyBonusEarnings: data.dailyBonusEarnings,
        });
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.warn('Profile sync warn:', error);
      setUserProfile(null);
      setLoading(false);
    });

    // Real-time referrals listener
    const referralsRef = collection(db, 'users', currentUid, 'referrals');
    const referralsQuery = query(referralsRef, orderBy('createdAt', 'desc'));

    let isFirstReferralsSnapshot = true;
    const unsubReferrals = onSnapshot(referralsQuery, (snapshot) => {
      const list: ReferralLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          timestamp: data.timestamp,
          amount: data.amount,
          referrerName: data.referrerName,
          refereeId: data.refereeId,
          createdAt: data.createdAt,
          refereeAvatar: data.refereeAvatar,
          ...data,
        });
      });

      if (!isFirstReferralsSnapshot) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            addToast(`New partner registered: ${data.name || 'Anonymous User'}! +$0.80 referral commission!`, 'success', 'new_referral');
          }
        });
      } else {
        isFirstReferralsSnapshot = false;
      }

      setLogs(list);
    }, (error) => {
      console.warn("Referrals snapshot fallback:", error);
    });

    // Real-time deposits listener
    const depositsRef = collection(db, 'users', currentUid, 'deposits');
    const depositsQuery = query(depositsRef, orderBy('createdAt', 'desc'));

    const unsubDeposits = onSnapshot(depositsQuery, (snapshot) => {
      const list: DepositLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          amount: Number(data.amount) || 0,
          network: data.network || 'BNB',
          txHash: data.txHash || '',
          status: data.status || 'pending',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
        });
      });
      setDeposits(list);
    }, (error) => {
      console.warn("Deposits snapshot fallback:", error);
    });

    // Real-time withdrawals listener
    const withdrawalsRef = collection(db, 'users', currentUid, 'withdrawals');
    const withdrawalsQuery = query(withdrawalsRef, orderBy('createdAt', 'desc'));

    const unsubWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
      const list: WithdrawalLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          amount: Number(data.amount) || 0,
          wallet: data.wallet || '',
          network: data.network || 'BNB',
          status: data.status || 'pending',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
        });
      });
      setWithdrawals(list);
    }, (error) => {
      console.warn("Withdrawals snapshot fallback:", error);
    });

    return () => {
      unsubUserProfile();
      unsubReferrals();
      unsubDeposits();
      unsubWithdrawals();
    };
  }, [currentUid]);

  // Handle URL invitation referral links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refId = params.get('ref');
      const src = params.get('src');
      if (refId) {
        setReferredBy(refId);
        if (src) {
          setReferredSource(src);
        }
        
        // Fetch the genuine referrer profile state to display welcoming message
        const fetchReferrer = async () => {
          try {
            const inviterRef = doc(db, 'users', refId);
            const inviterSnap = await getDoc(inviterRef);
            if (inviterSnap.exists()) {
              setInviterName(inviterSnap.data().name);
            }
          } catch (e) {
            console.error("Could not fetch welcome partner data:", e);
          }
        };
        fetchReferrer();
      }
    }
  }, []);




  // Submit a deposit record
  const handleCreateDeposit = async (amount: number, network: string, txHash: string) => {
    if (!currentUid) return;
    try {
      const depositRef = doc(collection(db, 'users', currentUid, 'deposits'));
      const now = new Date();
      const timestampStr = now.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' ' + now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      await setDoc(depositRef, {
        id: depositRef.id,
        amount,
        network,
        txHash,
        status: 'pending',
        createdAt: serverTimestamp(),
        timestamp: timestampStr
      });
      addToast(`Deposit of $${amount} submitted successfully! Auditing ledger verification started.`, 'success', 'deposit_submitted');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUid}/deposits`);
    }
  };

  // Submit a withdrawal request
  const handleCreateWithdrawal = async (amount: number, network: string, wallet: string) => {
    if (!currentUid) return;
    try {
      const withdrawRef = doc(collection(db, 'users', currentUid, 'withdrawals'));
      const now = new Date();
      const timestampStr = now.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' ' + now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      await setDoc(withdrawRef, {
        id: withdrawRef.id,
        amount,
        wallet,
        network,
        status: 'pending',
        createdAt: serverTimestamp(),
        timestamp: timestampStr
      });
      addToast(`Withdrawal of $${amount} requested successfully! Admin routing queue initiated.`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUid}/withdrawals`);
    }
  };

  // Helper for admin approval of deposits and withdrawals
  const handleUpdateTxStatus = async (type: 'deposit' | 'withdrawal', txId: string, status: 'approved' | 'rejected') => {
    if (!currentUid) return;
    try {
      const docRef = doc(db, 'users', currentUid, type === 'deposit' ? 'deposits' : 'withdrawals', txId);
      await setDoc(docRef, { status }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUid}/${type}s/${txId}`);
    }
  };

  // Claim passive daily rewards in database
  const handleClaimDailyReward = async (amount: number) => {
    if (!currentUid || !userProfile) return;
    try {
      const userRef = doc(db, 'users', currentUid);
      const currentEarnings = userProfile.dailyBonusEarnings || 0;
      const currentStreak = userProfile.claimStreak || 0;
      
      await setDoc(userRef, {
        dailyBonusEarnings: Number((currentEarnings + amount).toFixed(2)),
        claimStreak: currentStreak + 1,
        lastClaimedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Error claiming daily reward:", error);
      addToast("Failed to lock daily dividends inside cloud nodes.", "error");
    }
  };

  // Sign out handler using custom session persistence
  const handleSignOut = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('earnhub_logged_in_uid');
      setCurrentUid(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#E5E7EB] flex items-center justify-center font-sans antialiased">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF37] font-semibold animate-pulse">
            Configuring Secured Connection...
          </p>
        </div>
      </div>
    );
  }

  const handleSimulateDayAdvance = () => {
    if (!currentUid) return;
    const newVal = virtualDays + 1;
    setVirtualDays(newVal);
    localStorage.setItem(`earnhub_virtual_days_${currentUid}`, String(newVal));
  };

  const handleResetSimulation = () => {
    if (!currentUid) return;
    setVirtualDays(0);
    localStorage.removeItem(`earnhub_virtual_days_${currentUid}`);
  };

  const isRegistered = !!userProfile;

  // Real-time ledger balance calculation
  const signupBonus = userProfile?.signupBonus !== undefined ? userProfile.signupBonus : 0.5;
  const referralEarnings = logs.reduce((sum, log) => sum + (log.amount !== undefined ? log.amount : 0.8), 0);
  const approvedDepositsList = deposits.filter(d => d.status === 'approved');
  const approvedDeposits = approvedDepositsList.reduce((sum, d) => sum + d.amount, 0);
  const approvedWithdrawals = withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + w.amount, 0);
  const dailyBonusEarnings = userProfile?.dailyBonusEarnings !== undefined ? userProfile.dailyBonusEarnings : 0;

  // Calculate real-time profit accrued on each approved deposit of $5+
  // Rule: $5 deposit = $0.5/day profit (Cycle = 24 hours) => $0.5 return per day per $5 package
  const nowTime = Date.now();
  const investmentProfits = approvedDepositsList.reduce((sum, dep) => {
    const depTime = dep.createdAt?.seconds 
      ? dep.createdAt.seconds * 1000 
      : new Date(dep.timestamp).getTime() || nowTime;
    const elapsedMs = nowTime - depTime;
    const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    const totalDays = elapsedDaysReal;
    
    const units = Math.floor(dep.amount / 5);
    const profit = totalDays * units * 0.5;
    return sum + (profit > 0 ? profit : 0);
  }, 0);

  const balance = signupBonus + referralEarnings + approvedDeposits - approvedWithdrawals + investmentProfits + dailyBonusEarnings;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E7EB] font-sans flex flex-col justify-between antialiased selection:bg-[#D4AF37]/20 selection:text-[#D4AF37]">
      
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`px-4 py-3 rounded-xl border flex items-center gap-3 shadow-lg min-w-[280px] max-w-sm ${
                t.type === 'success' 
                  ? 'bg-[#111111] border-emerald-500/20 text-emerald-400' 
                  : 'bg-[#111111] border-rose-500/20 text-rose-400'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                t.type === 'success' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
              }`}>
                {t.type === 'success' ? '✓' : '✗'}
              </div>
              <p className="text-xs font-semibold text-white/90 font-sans tracking-wide leading-relaxed">
                {t.message}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dynamic Referral Invite Banner */}
      <AnimatePresence>
        {referredBy && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#0C0C0C] border-b border-white/5 text-[#E5E7EB] py-3 px-4 text-center text-xs font-medium z-50 relative shadow-sm"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 text-[9px] uppercase font-bold tracking-wider">
                Invitation Active
              </span>
              <p className="text-white/80 font-sans">
                You were invited by Partner <span className="font-bold text-[#D4AF37]">{inviterName ? `${inviterName} (#${referredBy.slice(0, 5)})` : `#${referredBy.slice(0, 5)}`}</span>! Onboard to start earning.
              </p>
              <button 
                onClick={() => setReferredBy(null)}
                className="text-[#D4AF37] hover:text-white transition-colors underline ml-2 cursor-pointer text-[10px]"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header and Branding */}
      <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-10 bg-[#0C0C0C]">
        <div className="flex items-center gap-3">
          <img 
            src={earnhubLogo} 
            alt="EarnHub Gold Logo Icon" 
            className="w-10 h-10 object-contain rounded-lg border border-[#D4AF37]/15 shadow-[0_0_15px_rgba(212,175,55,0.15)] bg-black"
            referrerPolicy="no-referrer"
          />
          <span className="text-lg font-bold tracking-[0.25em] uppercase font-serif text-white">EarnHub</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-semibold text-white/50">
          <span className="text-white border-b border-[#D4AF37] pb-1 cursor-default">Dashboard</span>
          <span className="hover:text-white transition-colors cursor-default">Network</span>
          <span className="hover:text-white transition-colors cursor-default">Payouts</span>
          <span className="text-[#D4AF37]/80 hover:text-white transition-colors cursor-default flex items-center gap-1.5" title="Live Google Cloud Firestore Connection Active">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Firestore Live
          </span>
        </div>

        <div className="flex items-center gap-3 animate-fade-in">
          {isRegistered ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] text-[#D4AF37] uppercase tracking-[0.2em] font-semibold">Premium Member</p>
                <p className="text-xs font-semibold text-white/90">{userProfile.name}</p>
              </div>
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                getAvatarConfig(userProfile.avatar).color
              }`}>
                <AvatarIcon id={userProfile.avatar} className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
              <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold">Ready to Onboard</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 py-12 px-4 md:px-8 flex flex-col items-center justify-center gap-8 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!isRegistered ? (
            <div key="registration" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center w-full max-w-6xl py-4">
              {/* Marketing Content Column (Earn Money While You Sleep) */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] text-[10px] uppercase font-bold tracking-widest font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Elite Passive Income Matrix
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-serif text-white tracking-tight leading-[1.1] text-balance">
                  Earn Money <br />
                  <span className="bg-gradient-to-r from-white via-white to-[#D4AF37] bg-clip-text text-transparent">
                    While You Sleep
                  </span>
                </h1>
                
                <p className="text-sm md:text-base text-white/60 leading-relaxed font-sans max-w-xl">
                  Discover the power of automated passive wealth. EarnHub's premium distribution system and secure staking cycles run continuously 24/7 on autopilot, generating real-time account yields and commissions even when you are resting.
                </p>

                {/* Features & Guarantees */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 space-y-1 hover:border-[#D4AF37]/20 transition-all">
                    <span className="text-[10px] font-bold text-[#D4AF37] tracking-wider uppercase block">
                      24h Payout Cycles
                    </span>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Yield distributions execute automatically every 24 hours, ensuring continuous daily accrual.
                    </p>
                  </div>

                  <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 space-y-1 hover:border-emerald-400/20 transition-all">
                    <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase block">
                      Fast Withdrawals
                    </span>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Request payouts with minimal settlement times! Once active ledger approval completes, funds are routed instantly.
                    </p>
                  </div>

                  <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 space-y-1 hover:border-[#D4AF37]/20 transition-all">
                    <span className="text-[10px] font-bold text-[#D4AF37] tracking-wider uppercase block">
                      Secure Ledger
                    </span>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Every transaction, referral commission, and package stake is recorded securely in real-time.
                    </p>
                  </div>

                  <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 space-y-1 hover:border-sky-400/20 transition-all">
                    <span className="text-[10px] font-bold text-sky-400 tracking-wider uppercase block">
                      24/7 Live Support
                    </span>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Chat directly with our team on Telegram 24/7 at <a href="https://t.me/EarnHubSupportTeam" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-bold font-mono">@EarnHubSupportTeam</a>.
                    </p>
                  </div>
                </div>

                {/* Live Stats Indicators */}
                <div className="pt-4 flex items-center gap-8 md:gap-12 text-[10px] text-white/30 uppercase tracking-widest font-semibold flex-wrap">
                  <div>
                    <p className="text-white text-xl md:text-2xl font-bold font-mono tracking-tight">$0.50</p>
                    <p className="mt-0.5">Signup Reward</p>
                  </div>
                  <div className="hidden sm:block w-px h-8 bg-white/10" />
                  <div>
                    <p className="text-white text-xl md:text-2xl font-bold font-mono tracking-tight">$0.80</p>
                    <p className="mt-0.5">Referral Bonus</p>
                  </div>
                  <div className="hidden sm:block w-px h-8 bg-white/10" />
                  <div>
                    <p className="text-white text-xl md:text-2xl font-bold font-mono tracking-tight">10%</p>
                    <p className="mt-0.5">Daily Growth Pack</p>
                  </div>
                </div>
              </div>

              {/* Secure Registration / Access Form Column */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
                <RegistrationCard 
                  referredBy={referredBy} 
                  referredSource={referredSource}
                  inviterName={inviterName} 
                  onLoginSuccess={(userId) => setCurrentUid(userId)} 
                />
              </div>
            </div>
          ) : (
            <div key="dashboard" className="w-full flex flex-col items-center gap-8">
              <DashboardCard
                name={userProfile.name}
                userId={userProfile.userId}
                balance={balance}
                referralCount={logs.length}
                logs={logs}
                avatar={userProfile.avatar}
                deposits={deposits}
                withdrawals={withdrawals}
                onCreateDeposit={handleCreateDeposit}
                onCreateWithdrawal={handleCreateWithdrawal}
                onUpdateTxStatus={handleUpdateTxStatus}
                onSignOut={handleSignOut}
                investmentProfits={investmentProfits}
                onAddToast={addToast}
                userProfile={userProfile}
                onClaimDailyReward={handleClaimDailyReward}
              />
              <ReferralHistory logs={logs} />
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Bar */}
      <footer className="h-14 border-t border-white/5 bg-[#080808] flex flex-col sm:flex-row items-center justify-between px-6 md:px-10 py-4 sm:py-0 text-[10px] text-[#E5E7EB]/20 uppercase tracking-[0.25em] space-y-1 sm:space-y-0">
        <div>&copy; {new Date().getFullYear()} EarnHub Collective. All rights reserved.</div>
        <div className="flex gap-6 items-center">
          <span>Compliance ID: #EH-992-KLR</span>
          <span className="text-[#D4AF37]/40 font-semibold">•</span>
          <span className="text-[#D4AF37]/50">Server Status: Optimal</span>
        </div>
      </footer>
    </div>
  );
}
