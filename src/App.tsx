/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { UserProfile, ReferralLog, DepositLog, WithdrawalLog, UserPlan } from './types';
import RegistrationCard from './components/RegistrationCard';
import DashboardCard from './components/DashboardCard';
import ReferralHistory from './components/ReferralHistory';
import AdminPanel from './components/AdminPanel';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarIcon, getAvatarConfig } from './lib/avatars';
import earnhubLogo from './assets/images/earnhub_logo_1780161493423.png';
import { playSound } from './lib/sounds';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  HelpCircle, 
  MessageSquare, 
  Menu, 
  X,
  Sparkles,
  TrendingUp,
  Award,
  User,
  Lock,
  ShieldCheck,
  RefreshCw,
  Play
} from 'lucide-react';


export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<ReferralLog[]>([]);
  const [deposits, setDeposits] = useState<DepositLog[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalLog[]>([]);
  const [investments, setInvestments] = useState<UserPlan[]>([]);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [referredSource, setReferredSource] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);

  // Load and manage simulated days offset
  const [virtualDays, setVirtualDays] = useState<number>(0);
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'funding' | 'faq'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [openedFooterDoc, setOpenedFooterDoc] = useState<'about' | 'contact' | 'privacy' | 'terms' | null>(null);
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // Hidden Super Admin access states
  const [logoClicks, setLogoClicks] = useState(0);
  const [showSecretPasscodePopup, setShowSecretPasscodePopup] = useState(false);
  const [isSuperAdminBypassed, setIsSuperAdminBypassed] = useState(() => {
    return localStorage.getItem('earnhub_super_admin_unlocked') === 'true';
  });

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
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        console.warn("Firestore connection check info:", error);
      }
    }
    testConnection();
  }, []);

  // Auto show introduction video modal on initial visit for non-registered users
  useEffect(() => {
    const loggedIn = localStorage.getItem('earnhub_logged_in_uid');
    if (!loggedIn) {
      const hasSeen = sessionStorage.getItem('earnhub_intro_video_viewed');
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setShowIntroVideo(true);
          sessionStorage.setItem('earnhub_intro_video_viewed', 'true');
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
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
            const commission = data.amount !== undefined ? data.amount : 0.50;
            addToast(`New partner registered: ${data.refereeName || data.name || 'Anonymous User'}! +$${commission.toFixed(2)} referral commission!`, 'success', 'new_referral');
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

    // Real-time investments listener
    const investmentsRef = collection(db, 'users', currentUid, 'investments');
    const investmentsQuery = query(investmentsRef, orderBy('createdAt', 'desc'));

    const unsubInvestments = onSnapshot(investmentsQuery, (snapshot) => {
      const list: UserPlan[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          planId: data.planId,
          amount: Number(data.amount) || 0,
          status: data.status || 'active',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
          cancelledAt: data.cancelledAt,
        });
      });
      setInvestments(list);
    }, (error) => {
      console.warn("Investments snapshot fallback:", error);
    });

    return () => {
      unsubUserProfile();
      unsubReferrals();
      unsubDeposits();
      unsubWithdrawals();
      if (unsubInvestments) unsubInvestments();
    };
  }, [currentUid]);

  // Handle URL invitation referral links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        let refId = params.get('ref')?.trim() || null;
        const src = params.get('src')?.trim() || null;
        
        if (refId) {
          // Remove trailing slashes and spaces often appended by messaging clients (e.g. WhatsApp, Facebook)
          refId = refId.replace(/\/+$/, '').trim();
          
          // Verify ID only contains valid characters (no spaces, no slashes, matching standard format)
          const isValidFormat = /^[a-zA-Z0-9_\-.@]+$/.test(refId);
          if (isValidFormat && refId.length > 0) {
            setReferredBy(refId);
            if (src) {
              setReferredSource(src);
            }
            
            // Fetch the genuine referrer profile state to display welcoming message
            const fetchReferrer = async () => {
              try {
                const inviterRef = doc(db, 'users', refId!);
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
      } catch (err) {
        console.error("Error parsing referral link parameter safely:", err);
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

  // Claim account daily rewards in database
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

  const handleCreatePlan = async (planId: string, amount: number) => {
    if (!currentUid) return;
    try {
      const invRef = doc(collection(db, 'users', currentUid, 'investments'));
      const now = new Date();
      const timestampStr = now.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
      }) + ' ' + now.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      await setDoc(invRef, {
        id: invRef.id,
        planId,
        amount,
        status: 'active',
        createdAt: serverTimestamp(),
        timestamp: timestampStr
      });
      addToast(`Investment Plan Activated successfully!`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUid}/investments`);
    }
  };

  const handleCancelPlan = async (invId: string) => {
    if (!currentUid) return;
    try {
      const invRef = doc(db, 'users', currentUid, 'investments', invId);
      await setDoc(invRef, { 
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      }, { merge: true });
      addToast(`Investment Plan Cancelled. Original principal has been returned to your wallet.`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUid}/investments/${invId}`);
    }
  };

  // Handle secret 7-clicks on website logo
  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 7) {
        setShowSecretPasscodePopup(true);
        addToast("🔐 Governance Protocol Activation Detected.", "success");
        return 0;
      }
      return next;
    });
  };

  // Handle click on top navbar or mobile drawer menu items
  const handleNavClick = (target: 'deposit' | 'withdraw' | 'helpline' | 'faq' | 'dashboard' | 'admin') => {
    setMobileMenuOpen(false); // Close mobile drawer if open
    
    if (target === 'admin') {
      setShowAdminModal(true);
      return;
    }

    if (target === 'helpline') {
      window.open('https://t.me/MoneyMindSpaceSupport', '_blank');
      addToast('Opening MoneyMind Space Support on Telegram...', 'success');
      return;
    }

    if (!isRegistered) {
      if (target === 'faq') {
        addToast('Please login or register to access FAQs and other premium features!', 'error');
      } else {
        addToast(`Please login or register to access the ${target === 'deposit' ? 'Deposit' : 'Withdrawal'} Portal!`, 'error');
      }
      
      const regEl = document.getElementById('registration-container');
      if (regEl) {
        regEl.scrollIntoView({ behavior: 'smooth' });
        // Visual indicator border glow
        regEl.classList.add('ring-2', 'ring-[#D4AF37]/50');
        setTimeout(() => regEl.classList.remove('ring-2', 'ring-[#D4AF37]/50'), 2500);
      }
      return;
    }

    // Interactive updates if user is Onboarded / Registered
    if (target === 'dashboard') {
      setDashboardTab('overview');
      setTimeout(() => {
        const el = document.getElementById('dashboard-container');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else if (target === 'deposit') {
      setDashboardTab('funding');
      setTimeout(() => {
        const el = document.getElementById('deposit-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    } else if (target === 'withdraw') {
      setDashboardTab('funding');
      setTimeout(() => {
        const el = document.getElementById('withdraw-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    } else if (target === 'faq') {
      setDashboardTab('faq');
      setTimeout(() => {
        const el = document.getElementById('faq-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
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
  const signupBonus = userProfile?.signupBonus !== undefined ? userProfile.signupBonus : 0.10;
  const referralEarnings = logs.reduce((sum, log) => sum + (typeof log.amount === 'number' ? log.amount : 0.05), 0);
  const approvedDepositsList = deposits.filter(d => d.status === 'approved');
  const approvedDeposits = approvedDepositsList.reduce((sum, d) => sum + d.amount, 0);
  const approvedWithdrawals = withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + w.amount, 0);
  const dailyBonusEarnings = userProfile?.dailyBonusEarnings !== undefined ? userProfile.dailyBonusEarnings : 0;

  // Calculate real-time profit accrued on each investment
  const nowTime = Date.now();
  const investmentProfits = investments.reduce((sum, processPlan) => {
    // If it's cancelled, we calculate up to cancelledAt, else up to now
    let endTime = nowTime;
    if (processPlan.status === 'cancelled' && processPlan.cancelledAt) {
      endTime = processPlan.cancelledAt?.seconds 
        ? processPlan.cancelledAt.seconds * 1000 
        : new Date(processPlan.cancelledAt).getTime() || nowTime;
    }

    const startTime = processPlan.createdAt?.seconds 
      ? processPlan.createdAt.seconds * 1000 
      : new Date(processPlan.timestamp).getTime() || nowTime;
      
    const elapsedMs = Math.max(0, endTime - startTime);
    const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    const totalDays = elapsedDaysReal + (processPlan.status === 'active' ? virtualDays : 0);
    
    let percent = 0;
    if (processPlan.amount >= 100) percent = 7;
    else if (processPlan.amount >= 50) percent = 5;
    else if (processPlan.amount >= 15) percent = 4;
    else if (processPlan.amount >= 5) percent = 3;
    
    const dailyRate = processPlan.amount * (percent / 100);
    const profit = totalDays * dailyRate;
    return sum + (profit > 0 ? profit : 0);
  }, 0);

  // The active investments are locked, so subtract from balance
  const activeInvestmentsSum = investments
    .filter(i => i.status === 'active')
    .reduce((sum, i) => sum + i.amount, 0);

  const balance = signupBonus + referralEarnings + approvedDeposits - approvedWithdrawals + dailyBonusEarnings + investmentProfits - activeInvestmentsSum;

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
      <header className="sticky top-0 z-50 border-b border-white/10 flex items-center justify-between px-6 md:px-10 bg-[#0C0C0C]/95 backdrop-blur-md h-20">
        <div className="flex items-center gap-3">
          <img 
            src={earnhubLogo} 
            alt="MoneyMind Space Gold Logo Icon" 
            onClick={handleLogoClick}
            className="w-10 h-10 object-contain rounded-lg border border-[#D4AF37]/15 shadow-[0_0_15px_rgba(212,175,55,0.15)] bg-black cursor-pointer active:scale-95 transition-transform"
            referrerPolicy="no-referrer"
          />
          <button 
            onClick={() => handleNavClick('dashboard')} 
            className="text-lg font-bold tracking-[0.25em] uppercase font-serif text-white hover:brightness-110 transition-all text-left bg-transparent border-0 cursor-pointer"
          >
            MONEYMIND SPACE
          </button>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6 text-[11px] uppercase tracking-[0.22em] font-bold text-white/50">
          <button 
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className={`transition-all pb-1 cursor-pointer bg-transparent border-0 ${isRegistered && dashboardTab === 'overview' ? 'text-white border-b border-[#D4AF37]' : 'hover:text-white/90'}`}
          >
            Dashboard
          </button>
          
          <button 
            type="button"
            onClick={() => handleNavClick('deposit')}
            className={`transition-all pb-1 cursor-pointer flex items-center gap-1.5 bg-transparent border-0 ${isRegistered && dashboardTab === 'funding' ? 'text-emerald-400 font-extrabold' : 'hover:text-white/90'}`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            Deposit
          </button>

          <button 
            type="button"
            onClick={() => handleNavClick('withdraw')}
            className={`transition-all pb-1 cursor-pointer flex items-center gap-1.5 bg-transparent border-0 ${isRegistered && dashboardTab === 'funding' ? 'text-[#D4AF37] font-extrabold' : 'hover:text-white/90'}`}
          >
            <ArrowUpRight className="w-4 h-4 text-[#D4AF37]" />
            Withdraw
          </button>

          <button 
            type="button"
            onClick={() => handleNavClick('helpline')}
            className="hover:text-sky-300 pb-1 transition-all cursor-pointer flex items-center gap-1.5 text-sky-400 font-extrabold bg-transparent border-0"
          >
            <MessageSquare className="w-4 h-4 text-sky-400 animate-pulse" />
            Helpline
          </button>

          <button 
            type="button"
            onClick={() => handleNavClick('faq')}
            className={`transition-all pb-1 cursor-pointer flex items-center gap-1.5 bg-transparent border-0 ${isRegistered && dashboardTab === 'faq' ? 'text-white border-b border-[#D4AF37]' : 'hover:text-white/90'}`}
          >
            <HelpCircle className="w-4 h-4 text-white" />
            FAQ
          </button>

          <span className="text-[#D4AF37]/85 hover:text-white transition-all cursor-default flex items-center gap-1.5 ml-2" title="Live Google Cloud Firestore Connection Active">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Firestore Live
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isRegistered ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-[#D4AF37] uppercase tracking-[0.2em] font-semibold">Premium Member</p>
                <p className="text-xs font-semibold text-white/90">{userProfile.name}</p>
              </div>
              <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-[#D4AF37]">
                <User className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
              <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold">Ready to Onboard</span>
            </div>
          )}

          {/* Mobile menu trigger */}
          <button 
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-white/10 md:hidden hover:bg-white/5 active:scale-95 transition-all text-white/80 cursor-pointer bg-transparent"
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#D4AF37]" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown Bar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden bg-[#0C0C0C] border-b border-white/10 z-50 overflow-hidden w-full"
          >
            <div className="px-6 py-5 flex flex-col gap-4 font-sans text-sm font-semibold tracking-wide text-white/70">
              <button 
                type="button"
                onClick={() => handleNavClick('dashboard')}
                className={`py-2 text-left flex items-center justify-between border-b border-white/[0.03] transition-all cursor-pointer bg-transparent border-0 ${isRegistered && dashboardTab === 'overview' ? 'text-white font-extrabold border-[#D4AF37]/50' : 'hover:text-white'}`}
              >
                <span>Dashboard Overview</span>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-[#D4AF37] uppercase">Growth</span>
              </button>

              <button 
                type="button"
                onClick={() => handleNavClick('deposit')}
                className="py-2 text-left flex items-center justify-between border-b border-white/[0.03] transition-all cursor-pointer text-emerald-400 font-extrabold hover:brightness-110 bg-transparent border-0"
              >
                <span className="flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4" />
                  Deposit Funds
                </span>
                <span className="text-[10px] bg-emerald-500/10 px-2.5 py-0.5 rounded text-emerald-400 border border-emerald-500/20 uppercase tracking-widest text-[8px] font-black">Daily Yield</span>
              </button>

              <button 
                type="button"
                onClick={() => handleNavClick('withdraw')}
                className="py-2 text-left flex items-center justify-between border-b border-white/[0.03] transition-all cursor-pointer text-[#D4AF37] font-extrabold hover:brightness-110 bg-transparent border-0"
              >
                <span className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4" />
                  Withdraw Funds
                </span>
                <span className="text-[10px] bg-[#D4AF37]/10 px-2.5 py-0.5 rounded text-[#D4AF37] border border-[#D4AF37]/20 uppercase tracking-widest text-[8px] font-black">Withdraw</span>
              </button>

              <button 
                type="button"
                onClick={() => handleNavClick('helpline')}
                className="py-2 text-left flex items-center gap-2 border-b border-white/[0.03] transition-all text-sky-400 hover:text-sky-300 font-extrabold cursor-pointer bg-transparent border-0"
              >
                <MessageSquare className="w-4 h-4 animate-pulse" />
                <span>Customer Telegram Helpline</span>
              </button>

              <button 
                type="button"
                onClick={() => handleNavClick('faq')}
                className={`py-2 text-left flex items-center gap-2 border-b border-white/[0.03] transition-all cursor-pointer bg-transparent border-0 ${isRegistered && dashboardTab === 'faq' ? 'text-white font-extrabold' : 'hover:text-white'}`}
              >
                <HelpCircle className="w-4 h-4 text-white/50" />
                <span>Frequently Asked Questions (FAQ)</span>
              </button>

              <div className="flex items-center justify-between pt-2 text-[10px] font-medium text-white/40 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Firestore Ledger Core Live</span>
                </div>
                <span>v3.5 Optimal</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame */}
      <main className="flex-1 py-12 px-4 md:px-8 flex flex-col items-center justify-center gap-8 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!isRegistered ? (
            <div key="registration" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center w-full max-w-6xl py-4">
              {/* Marketing Content Column (MoneyMind Space) */}
              <div className="lg:col-span-7 space-y-6 text-left animate-fade-in">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] text-[10px] uppercase font-bold tracking-widest font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Smart Finance, Better Future
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-serif text-white tracking-tight leading-[1.1] text-balance">
                  Grow Your Wealth <br />
                  <span className="bg-gradient-to-r from-white via-white to-[#D4AF37] bg-clip-text text-transparent">
                    With Smart Financial Planning
                  </span>
                </h1>
                
                <p className="text-sm md:text-base text-white/60 leading-relaxed font-sans max-w-xl">
                  Join MoneyMind Space to track earnings, manage investments, and build a stronger financial future with confidence and security.
                </p>

                {/* Premium Interactive Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button 
                    onClick={() => {
                      document.getElementById('registration-container')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-6 py-3 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[#bfa032] active:scale-95 transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)] cursor-pointer"
                  >
                    Get Started
                  </button>
                  <button 
                    onClick={() => {
                      document.getElementById('registration-container')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    View Plans
                  </button>
                  <button 
                    onClick={() => setShowIntroVideo(true)}
                    className="px-6 py-3 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 text-[#D4AF37] font-extrabold text-xs uppercase tracking-wider hover:bg-[#D4AF37]/10 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-[#D4AF37]" />
                    Watch Intro Video
                  </button>
                </div>

                {/* Premium Core Stats Section */}
                <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left border-t border-white/5">
                  <div className="space-y-1">
                    <p className="text-white text-lg md:text-2xl font-bold font-mono tracking-tight text-[#D4AF37]">10,000+</p>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Active Members</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white text-lg md:text-2xl font-bold font-mono tracking-tight text-emerald-400">Secure</p>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Platform</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white text-lg md:text-2xl font-bold font-mono tracking-tight text-white">Fast</p>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Withdrawals</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[#D4AF37] text-lg md:text-2xl font-bold font-mono tracking-tight text-sky-400">24/7</p>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Support</p>
                  </div>
                </div>
              </div>

              {/* Secure Registration / Access Form Column */}
              <div id="registration-container" className="lg:col-span-5 flex justify-center lg:justify-end w-full scroll-mt-24 transition-all duration-300 rounded-3xl">
                <RegistrationCard 
                  referredBy={referredBy} 
                  referredSource={referredSource}
                  inviterName={inviterName} 
                  onLoginSuccess={(userId) => setCurrentUid(userId)} 
                />
              </div>
            </div>
          ) : (
            <div key="dashboard" id="dashboard-container" className="scroll-mt-24 w-full flex flex-col items-center gap-8">
              <DashboardCard
                name={userProfile.name}
                userId={userProfile.userId}
                balance={balance}
                referralCount={logs.length}
                logs={logs}
                avatar={userProfile.avatar}
                deposits={deposits}
                withdrawals={withdrawals}
                investments={investments}
                onCreateDeposit={handleCreateDeposit}
                onCreateWithdrawal={handleCreateWithdrawal}
                onCreatePlan={handleCreatePlan}
                onCancelPlan={handleCancelPlan}
                onUpdateTxStatus={handleUpdateTxStatus}
                onSignOut={handleSignOut}
                investmentProfits={investmentProfits}
                onAddToast={addToast}
                userProfile={userProfile}
                onClaimDailyReward={handleClaimDailyReward}
                virtualDays={virtualDays}
                activeTab={dashboardTab}
                onActiveTabChange={setDashboardTab}
              />
              <ReferralHistory logs={logs} userId={currentUid || ''} walletBalance={balance} />
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Bar */}
      <footer className="border-t border-white/5 bg-[#080808] flex flex-col md:flex-row items-center justify-between px-6 md:px-10 py-6 md:py-4 text-[10px] text-[#E5E7EB]/20 uppercase tracking-[0.25em] space-y-3 md:space-y-0">
        <div className="text-center md:text-left">&copy; {new Date().getFullYear()} MoneyMind Space</div>
        
        {/* AdSense policy and branding links */}
        <div className="flex flex-wrap justify-center gap-3.5 text-[#D4AF37] font-sans text-[9px] font-bold tracking-wider uppercase">
          <button onClick={() => setOpenedFooterDoc('about')} className="hover:underline hover:text-white cursor-pointer bg-transparent border-0 uppercase">About Us</button>
          <span>•</span>
          <button onClick={() => setOpenedFooterDoc('contact')} className="hover:underline hover:text-white cursor-pointer bg-transparent border-0 uppercase">Contact Us</button>
          <span>•</span>
          <button onClick={() => setOpenedFooterDoc('privacy')} className="hover:underline hover:text-white cursor-pointer bg-transparent border-0 uppercase">Privacy Policy</button>
          <span>•</span>
          <button onClick={() => setOpenedFooterDoc('terms')} className="hover:underline hover:text-white cursor-pointer bg-transparent border-0 uppercase">Terms & Conditions</button>
        </div>

        <div className="flex gap-4 items-center font-sans tracking-widest justify-center">
          <span>Compliance: #MMS-992-KLR</span>
          <span className="text-[#D4AF37]/40 font-semibold">•</span>
          <span className="text-[#D4AF37]/50">Status: Active</span>
        </div>
      </footer>

      {/* Dynamic Static Information Pages Modal (AdSense Friendly) */}
      <AnimatePresence>
        {openedFooterDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-2xl bg-[#0C0C0C] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.1)] flex flex-col max-h-[85vh]"
            >
              {/* Modal Top header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0F0F0F]">
                <div>
                  <h2 className="text-xs uppercase font-extrabold tracking-[0.2em] text-[#D4AF37] font-sans">
                    {openedFooterDoc === 'about' && 'About MoneyMind Space'}
                    {openedFooterDoc === 'contact' && 'Contact Support Center'}
                    {openedFooterDoc === 'privacy' && 'Official Privacy Policy'}
                    {openedFooterDoc === 'terms' && 'Core Terms & Conditions'}
                  </h2>
                  <p className="text-[8px] text-white/30 uppercase tracking-widest leading-none mt-1">Official platform legal document center</p>
                </div>
                <button
                  onClick={() => setOpenedFooterDoc(null)}
                  className="p-2 rounded-xl border border-white/5 bg-transparent hover:bg-white/5 text-white/50 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Scrollable Core Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 font-sans text-xs text-white/70 leading-relaxed text-left">
                {openedFooterDoc === 'about' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Welcome to MoneyMind Space</h3>
                    <p>
                      MoneyMind Space is a modern financial platform designed to help users manage their accounts, track activity, monitor earnings, and access financial tools through a secure and user-friendly dashboard.
                    </p>
                    <p>
                      Our mission is to provide a simple, transparent, and reliable digital experience for users who want to stay informed and organized in their financial journey.
                    </p>
                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-white uppercase text-[10px] tracking-wider text-[#D4AF37]">We focus heavily on:</p>
                      <ul className="list-disc list-inside space-y-1 text-white/60 text-[11px]">
                        <li>User-friendly dashboard experience</li>
                        <li>Secure account management</li>
                        <li>Real-time activity tracking</li>
                        <li>Referral and community features</li>
                        <li>Reliable customer support</li>
                      </ul>
                    </div>
                    <p className="text-[11px] text-white/40 italic">
                      At MoneyMind Space, we continuously improve our platform to provide a better experience for all members.
                    </p>
                  </div>
                )}

                {openedFooterDoc === 'contact' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Contact Information</h3>
                    <p>
                      If you have any questions, suggestions, or require assistance, please contact our support team.
                    </p>
                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2.5 font-mono text-[11px]">
                      <div>
                        <span className="text-white/30 block uppercase text-[9px] tracking-wider font-sans font-bold">Official Support Email</span>
                        <a href="mailto:support@moneymindspace.online" className="text-[#D4AF37] hover:underline">support@moneymindspace.online</a>
                      </div>
                      <div>
                        <span className="text-white/30 block uppercase text-[9px] tracking-wider font-sans font-bold">Corporate Website</span>
                        <span className="text-white font-bold">moneymindspace.online</span>
                      </div>
                      <div>
                        <span className="text-white/30 block uppercase text-[9px] tracking-wider font-sans font-bold">Support Hours</span>
                        <span className="text-white">24 Hours / 7 Days Live Help Desk</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/40 italic">
                      We aim to respond to all inquiries as quickly as possible.
                    </p>
                  </div>
                )}

                {openedFooterDoc === 'privacy' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Privacy Policy</h3>
                    <p>
                      At MoneyMind Space, we value your privacy and are committed to protecting your personal information.
                    </p>
                    
                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-white uppercase text-[10px] tracking-wider text-[#D4AF37]">We may collect information such as:</p>
                      <ul className="list-disc list-inside space-y-1 text-white/60 text-[11px]">
                        <li>Name & user identifiers</li>
                        <li>Email address</li>
                        <li>Account transactions and states</li>
                        <li>Website usage logs and platform metrics</li>
                      </ul>
                    </div>

                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-white uppercase text-[10px] tracking-wider text-[#D4AF37]">This information is used to:</p>
                      <ul className="list-disc list-inside space-y-1 text-white/60 text-[11px]">
                        <li>Improve user experience and platform responsiveness</li>
                        <li>Provide high quality customer support</li>
                        <li>Maintain overall server and data ledger security</li>
                        <li>Enhance our general web tools</li>
                      </ul>
                    </div>

                    <p>
                      We do not sell personal information to third parties. By using our website, you agree to this Privacy Policy.
                    </p>
                    <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest pt-2">
                      Last Updated: June 2026
                    </p>
                  </div>
                )}

                {openedFooterDoc === 'terms' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Terms and Conditions</h3>
                    <p>
                      By accessing and using MoneyMind Space, you agree to comply with these terms and conditions.
                    </p>

                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-white uppercase text-[10px] tracking-wider text-[#D4AF37]">Users agree to:</p>
                      <ul className="list-disc list-inside space-y-1 text-white/60 text-[11px]">
                        <li>Provide accurate and precise information</li>
                        <li>Maintain strict account credentials security</li>
                        <li>Follow all applicable local and regional laws</li>
                        <li>Use high-security practices and engage platform tools responsibly</li>
                      </ul>
                    </div>

                    <p>
                      MoneyMind Space reserves the right to modify services, update policies, or suspend accounts that violate these terms. Continued use of the platform constitutes acceptance of any updated terms.
                    </p>
                    <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest pt-2">
                      Last Updated: June 2026
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-white/5 bg-[#080808] text-right">
                <button
                  onClick={() => setOpenedFooterDoc(null)}
                  className="px-4 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-[10px] uppercase font-bold tracking-widest cursor-pointer text-white"
                >
                  Confirm & Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Access Control Console Modal Overlay */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-6xl bg-[#090909] border border-[#D4AF37]/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col my-8 max-h-[90vh]"
            >
              {/* Modal Top Bar header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0C0C0C]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37]">
                    <ShieldCheck className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xs uppercase font-bold tracking-[0.2em] text-[#D4AF37] font-serif">Governance Console</h2>
                    <p className="text-[8px] text-white/30 uppercase tracking-widest leading-none mt-0.5">Secure Cloud Administrator Core</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAdminModal(false)}
                  className="p-2 rounded-xl border border-white/5 bg-transparent hover:bg-white/5 text-white/50 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                  aria-label="Close governance window"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Core Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <AdminPanel 
                  onAddToast={addToast} 
                  currentUserId={currentUid || 'anonymous-operator'} 
                  isBypassed={isSuperAdminBypassed}
                />
              </div>

              {/* Admin Footer Banner info */}
              <div className="px-6 py-3 border-t border-white/5 bg-[#050505] text-[8px] text-center text-white/20 uppercase tracking-[0.2em] font-sans flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>MoneyMind Space Audit Log: Enabled</span>
                <span className="text-[#D4AF37]/35 font-mono">Operator ID: {currentUid ? currentUid.slice(0, 16) : 'anonymous'}</span>
                <span>SECURE SESSION TYPE: TLS 1.3 AES-256</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Secret Passcode Prompt Dialog Overlay */}
      <AnimatePresence>
        {showSecretPasscodePopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#0C0C0C] border border-[#D4AF37]/35 rounded-2xl p-6 space-y-5 shadow-[0_0_50px_rgba(212,175,55,0.15)] text-left"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-xl flex items-center justify-center mx-auto text-[#D4AF37] animate-pulse">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-xs uppercase tracking-[0.22em] text-[#D4AF37] font-black">Governance Node Access</h3>
                <p className="text-[8px] text-white/30 uppercase tracking-[0.1em] font-sans">Authorization Security Screen</p>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const passcode = (form.elements.namedItem('secretPasscode') as HTMLInputElement).value.trim();
                  
                  const correctPasscode = import.meta.env.VITE_ADMIN_PASSCODE || 'EARNHUB2026ADMIN';
                  
                  if (passcode === correctPasscode) {
                    localStorage.setItem('earnhub_super_admin_unlocked', 'true');
                    setIsSuperAdminBypassed(true);
                    setShowSecretPasscodePopup(false);
                    setShowAdminModal(true); // Fire up Super Admin Console
                    addToast('🔐 Secret Access Granted: Super Admin Node Unlocked.', 'success');
                  } else {
                    addToast('❌ Security Warning: Passcode validation failed.', 'error');
                  }
                }}
                className="space-y-4 font-sans"
              >
                <div className="space-y-1.5">
                  <span className="text-[9px] text-white/40 uppercase tracking-wider font-extrabold block">Governance Passcode</span>
                  <input 
                    name="secretPasscode"
                    type="password" 
                    required
                    placeholder="Enter Security Admin Passcode"
                    autoFocus
                    className="w-full bg-[#070707] border border-white/5 focus:border-[#D4AF37]/35 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 outline-none transition-all text-center font-mono tracking-widest uppercase"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 text-[9px] uppercase font-black tracking-widest font-sans">
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-[#D4AF37] to-[#B29430] hover:brightness-110 active:scale-[0.98] transition-all rounded-xl text-black shadow-lg shadow-[#D4AF37]/10 cursor-pointer border-0"
                  >
                    Authenticate
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowSecretPasscodePopup(false)}
                    className="px-4 py-3 border border-white/5 bg-transparent hover:bg-white/5 active:scale-[0.98] transition-all rounded-xl text-white/50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Introduction Video Modal Overlay */}
      <AnimatePresence>
        {showIntroVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-4xl bg-[#0C0C0C] border border-[#D4AF37]/20 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col max-h-[85vh]"
            >
              {/* Modal Top header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0F0F0F]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37]">
                    <Play className="w-4 h-4 fill-current animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xs uppercase font-extrabold tracking-[0.2em] text-[#D4AF37] font-sans">
                      MoneyMind Space Overview
                    </h2>
                    <p className="text-[8px] text-white/30 uppercase tracking-widest leading-none mt-1">Official platform video walkthrough</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIntroVideo(false)}
                  className="p-2 rounded-xl border border-white/5 bg-transparent hover:bg-white/5 text-white/50 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* YouTube Video Embed Responsive Container */}
              <div className="relative aspect-video w-full bg-black flex-1 flex items-center justify-center overflow-hidden">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/Itjprahot5U?autoplay=1&rel=0"
                  title="MoneyMind Space Introduction Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              {/* Modal Footer actions */}
              <div className="px-6 py-4 border-t border-white/5 bg-[#080808] flex items-center justify-between">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium hidden sm:block">
                  Watch to understand and maximize your financial growth
                </p>
                <div className="flex gap-3 w-full sm:w-auto text-[10px] font-bold tracking-widest uppercase">
                  <button
                    onClick={() => {
                      setShowIntroVideo(false);
                      document.getElementById('registration-container')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-[#D4AF37] hover:bg-[#bfa032] text-black font-extrabold text-[10px] uppercase tracking-wider rounded-lg active:scale-95 transition-all cursor-pointer border-0"
                  >
                    Get Started Now
                  </button>
                  <button
                    onClick={() => setShowIntroVideo(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 border border-white/10 hover:bg-white/5 transition-all text-[10px] uppercase font-bold tracking-widest rounded-lg cursor-pointer text-white bg-transparent"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
