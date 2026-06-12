/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Users, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Terminal, 
  Search, 
  Lock, 
  Unlock, 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Cpu, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Zap, 
  HelpCircle,
  Clock,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import SecurityAudit from './SecurityAudit';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend
} from 'recharts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc,
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { playSound } from '../lib/sounds';

interface AdminPanelProps {
  onAddToast: (message: string, type: 'success' | 'error', sound?: any) => void;
  currentUserId: string;
  isBypassed?: boolean;
}

interface AdminUser {
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  blocked?: boolean;
  isSuspicious?: boolean;
  ipAddress?: string;
  deviceFingerprint?: string;
  browserInfo?: string;
  emailVerified?: boolean;
  signupBonus?: number;
  createdAt?: any;
  deposits: any[];
  withdrawals: any[];
  investments: any[];
  referrals: any[];
  dailyBonusEarnings?: number;
}

interface AuditLog {
  id: string;
  action: string;
  time: string;
  admin: string;
  type: 'auth' | 'financial' | 'security' | 'system';
  ip?: string;
}

export default function AdminPanel({ onAddToast, currentUserId, isBypassed = false }: AdminPanelProps) {
  // Authentication states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(isBypassed);
  const [adminUserId, setAdminUserId] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isBypassed) {
      setIsAdminAuthenticated(true);
      fetchAllData();
    }
  }, [isBypassed]);
  
  // Database-wide state
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterWStatus, setFilterWStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [filterType, setFilterType] = useState<'all' | 'deposits' | 'withdrawals'>('all');

  // Transaction Search & Date Range Filters
  const [txSearchText, setTxSearchText] = useState('');
  const [txStartDate, setTxStartDate] = useState('');
  const [txEndDate, setTxEndDate] = useState('');

  // Anti-fraud analytics flags state
  const [antiFraudFlags, setAntiFraudFlags] = useState<{
    desc: string;
    level: 'low' | 'medium' | 'high';
    type: string;
  }[]>([]);

  // Simulation controls
  const [processingTxId, setProcessingTxId] = useState<string | null>(null);
  const [blockchainHash, setBlockchainHash] = useState<string | null>(null);
  const [telegramLogs, setTelegramLogs] = useState<{ msg: string; time: string }[]>([]);

  // Manual override states
  const [overrideTarget, setOverrideTarget] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'security'>('dashboard');

  const handleManualOverrideUnban = async (target: string) => {
    if (!target.trim()) {
      onAddToast("Please provide a valid User ID, IP, or Fingerprint.", "error");
      return;
    }
    setOverrideLoading(true);
    let matchedCount = 0;
    try {
      const cleanTarget = target.trim();
      const usersToUnban = allUsers.filter(u => 
        u.userId.toLowerCase() === cleanTarget.toLowerCase() ||
        (u.ipAddress && u.ipAddress.trim() === cleanTarget) ||
        (u.deviceFingerprint && u.deviceFingerprint.trim() === cleanTarget)
      );

      if (usersToUnban.length === 0) {
        onAddToast("❌ No accounts matched this ID, IP or Fingerprint.", "error");
        setOverrideLoading(false);
        return;
      }

      for (const u of usersToUnban) {
        const uRef = doc(db, 'users', u.userId);
        await updateDoc(uRef, {
          blocked: false,
          isSuspicious: false
        });
        matchedCount++;
      }

      onAddToast(`✔ Manually restored ${matchedCount} account(s) successfully!`, "success");
      logAuditAction(`Administrative manual override list unbanned target: ${cleanTarget}`, 'security');
      logTelegramNotify(`🔓 Anti-Fraud Override: Daneish manually unbanned matches for ${cleanTarget}`);
      setOverrideTarget('');
      fetchAllData();
    } catch (e) {
      console.error(e);
      onAddToast("Overriding ban failed.", "error");
    } finally {
      setOverrideLoading(false);
    }
  };

  // Supported administrators
  const ADMIN_EMAILS = ["admin@gmail.com", "danishrehmani72@gmail.com", "superadmin@moneymindspace.com", "superadmin@earnhub.com"];

  // Push mock Telegram webhook notification
  const logTelegramNotify = (message: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setTelegramLogs(prev => [{ msg: message, time: timeStr }, ...prev.slice(0, 50)]);
  };

  // Log persistent action inside Firestore
  const logAuditAction = async (action: string, type: 'auth' | 'financial' | 'security' | 'system') => {
    try {
      const now = new Date();
      const timeStr = now.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' ' + now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const logData = {
        action,
        time: timeStr,
        admin: adminUserId || 'Danish',
        type,
        ip: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
        createdAt: serverTimestamp()
      };

      // Store in firestore collection
      await addDoc(collection(db, 'audit_logs'), logData);
    } catch (e) {
      console.warn("Audit log persistent storage failed, showing locally instead:", e);
    }
  };

  // Perform secure admin check in
  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanId = adminUserId.trim().toLowerCase();
    const cleanCode = adminCode.trim();

    // STRICT IDENTITY & PASSWORD MATCH
    const isAuthorizedId = 
      cleanId === 'danish' || 
      cleanId === 'danishrehmani72' || 
      cleanId === 'danishrehmani72@gmail.com' ||
      cleanId === 'adminmoneymind' ||
      cleanId === 'adminearnhub';
      
    const isAuthorizedCode = 
      cleanCode === '7272' || 
      cleanCode === 'danish7272' || 
      cleanCode === 'danish123' ||
      cleanCode === 'Rehmani7602@' ||
      cleanCode === 'ADMIN2026HUB' ||
      cleanCode === 'admin2026hub';

    if (!isAuthorizedId) {
      setAuthError('❌ Access Denied: Unauthorized admin user ID');
      playSound('deposit_submitted'); // Warning drone tone
      return;
    }
    
    if (!isAuthorizedCode) {
      setAuthError('❌ Security Error: Invalid secret verification code.');
      return;
    }

    setIsAdminAuthenticated(true);
    onAddToast(`Admin Portal unlocked: Welcome back Danish! 🔐`, 'success');
    logAuditAction(`Administrative session initiated by Danish (${cleanId})`, 'auth');
    logTelegramNotify(`🔐 Security Node: Admin session initialized for ${cleanId}`);
    fetchAllData();
  };

  // Retrieve global users and nested logs (deposits, referrals, withdrawals) Real-time simulator
  const fetchAllData = async () => {
    setIsDataLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedUsers: AdminUser[] = [];

      // Loop through all profiles to fetch subcollections sequentially/parallel for absolute fail-safe
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Deposits subcollection
        let userDeps: any[] = [];
        try {
          const depSnap = await getDocs(collection(db, 'users', userId, 'deposits'));
          userDeps = depSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn(`Fallback: Failed to fetch deposits for ${userId}`, err);
        }

        // Withdrawals subcollection
        let userWits: any[] = [];
        try {
          const witSnap = await getDocs(collection(db, 'users', userId, 'withdrawals'));
          userWits = witSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn(`Fallback: Failed to fetch withdrawals for ${userId}`, err);
        }

        // Investments subcollection
        let userInvs: any[] = [];
        try {
          const invSnap = await getDocs(collection(db, 'users', userId, 'investments'));
          userInvs = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn(`Fallback: Failed to fetch investments for ${userId}`, err);
        }

        // Referrals subcollection
        let userRefs: any[] = [];
        try {
          const refSnap = await getDocs(collection(db, 'users', userId, 'referrals'));
          userRefs = refSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn(`Fallback: Failed to fetch referrals for ${userId}`, err);
        }

        fetchedUsers.push({
          userId,
          name: userData.name || 'Anonymous VIP',
          email: userData.email || 'no-email@wealthhub.com',
          avatar: userData.avatar,
          blocked: userData.blocked || false,
          isSuspicious: userData.isSuspicious || false,
          ipAddress: userData.ipAddress || '',
          deviceFingerprint: userData.deviceFingerprint || '',
          browserInfo: userData.browserInfo || '',
          emailVerified: userData.emailVerified || false,
          signupBonus: userData.signupBonus !== undefined ? userData.signupBonus : 0.10,
          createdAt: userData.createdAt,
          deposits: userDeps,
          withdrawals: userWits,
          investments: userInvs,
          referrals: userRefs,
          dailyBonusEarnings: userData.dailyBonusEarnings || 0
        });
      }

      // Fetch dynamic security logs
      try {
        const secLogsSnap = await getDocs(collection(db, 'security_logs'));
        const fetchedSecLogs = secLogsSnap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })).sort((a: any, b: any) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });
        setSecurityLogs(fetchedSecLogs);
      } catch (secError) {
        console.warn("Silent failure loading database security logs collection:", secError);
      }

      setAllUsers(fetchedUsers);
      analyzeSecurityAntiFraud(fetchedUsers);
    } catch (e) {
      console.error("Critical Admin Retrieval Error:", e);
      onAddToast("Error pulling global admin database matrices.", "error");
    } finally {
      setIsDataLoading(false);
    }
  };

  // Load audit logs in real-time if available
  useEffect(() => {
    if (!isAdminAuthenticated) return;

    // Set up real-time listener for audit logs collection
    const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const logsList: AuditLog[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        logsList.push({
          id: docSnap.id,
          action: d.action || '',
          time: d.time || '',
          admin: d.admin || 'System',
          type: d.type || 'system',
          ip: d.ip || '127.0.0.1'
        });
      });
      setAuditLogs(logsList);
    }, (error) => {
      console.warn("Audit logs listener failed, using local audit mock.", error);
    });

    return () => unsub();
  }, [isAdminAuthenticated]);

  // Anti-fraud heuristic engine (Duplicate TxHashes, Duplicate Referrals, Big withdrawal requests, Double submission alert)
  const analyzeSecurityAntiFraud = (users: AdminUser[]) => {
    const flags: typeof antiFraudFlags = [];
    const hashMeters: Record<string, string[]> = {};
    const refMeters: Record<string, string[]> = {};

    users.forEach(u => {
      // Check for excessive withdrawal requests
      const pendingWits = u.withdrawals.filter(w => w.status === 'pending');
      if (pendingWits.length > 2) {
        flags.push({
          type: 'EXCESSIVE_PAYOUT_REQ',
          level: 'medium',
          desc: `User [${u.name}] has ${pendingWits.length} stacked pending payouts. Possible script-spam.`
        });
      }

      // Check for large payouts
      u.withdrawals.forEach(w => {
        if (w.status === 'pending' && w.amount > 50) {
          flags.push({
            type: 'LARGE_PAYOUT_ALERT',
            level: 'high',
            desc: `User [${u.name}] requested large outbound payout of $${w.amount.toFixed(2)} USD value.`
          });
        }
      });

      // Track txHash collisions to spot falsified ledger submissions
      u.deposits.forEach(d => {
        if (d.txHash) {
          const cleanHash = d.txHash.trim().toLowerCase();
          if (!hashMeters[cleanHash]) {
            hashMeters[cleanHash] = [];
          }
          hashMeters[cleanHash].push(u.name);
        }
      });
    });

    // Detect duplicate hash exploits
    Object.entries(hashMeters).forEach(([hash, claimants]) => {
      if (claimants.length > 1) {
        flags.push({
          type: 'DUPLICATE_TXHASH_EXPLOIT',
          level: 'high',
          desc: `Colliding TXHash [${hash.slice(0, 10)}...] spotted! Submitted by: ${claimants.join(' & ')}. Critical Ledger Abuse warning!`
        });
      }
    });

    setAntiFraudFlags(flags);
  };

  // Toggle user block status persistently in Firestore
  const handleToggleBlock = async (userId: string, currentBlockStatus: boolean) => {
    try {
      const uRef = doc(db, 'users', userId);
      await updateDoc(uRef, { blocked: !currentBlockStatus });
      onAddToast(`User profile [${userId}] blocked status changed to ${!currentBlockStatus}`, 'success');
      logAuditAction(`Administrative action: changed block status of ${userId} to ${!currentBlockStatus}`, 'security');
      logTelegramNotify(`🚫 Anti-Fraud Action: Administrator ${!currentBlockStatus ? 'blocked' : 'unblocked'} user ${userId}`);
      fetchAllData();
    } catch (e) {
      console.error(e);
      onAddToast("Failed to alter block profile.", "error");
    }
  };

  // Permanently delete user document from database
  const handleDeleteUser = async (userId: string) => {
    if (window.confirm(`⚠️ CRITICAL ACTION: Are you sure you want to permanently delete user #${userId}? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        onAddToast(`User profile [#${userId}] deleted successfully.`, 'success');
        logAuditAction(`Administrative action: permanently deleted user profile #${userId}`, 'security');
        logTelegramNotify(`⚠️ Data Purge: User #${userId} permanently deleted by administrator.`);
        fetchAllData();
      } catch (e) {
        console.error(e);
        onAddToast("Failed to delete user profile from Firestore.", "error");
      }
    }
  };

  // Administrative verification of tx (Deposit or Withdrawal Payout)
  const handleAdminVerifyTx = async (
    type: 'deposit' | 'withdrawal',
    userUid: string,
    txId: string,
    action: 'approved' | 'rejected',
    amount?: number,
    userName?: string
  ) => {
    const actionLabel = action === 'approved' ? 'APPROVE' : 'REJECT / DENY';
    const amountStr = amount !== undefined ? ` of $${amount.toFixed(2)}` : '';
    const userStr = userName ? ` for ${userName}` : '';
    if (!window.confirm(`⚠️ CONFIRMATION REQUIRED:\n\nAre you sure you want to ${actionLabel} this ${type} verification request${amountStr}${userStr}?\n\nThis action will update the ledger live.`)) {
      return;
    }

    setProcessingTxId(txId);
    setBlockchainHash(null);

    try {
      if (type === 'withdrawal' && action === 'approved') {
        // Super Ultimate Feature: Blockchain smart contract dispatch simulation
        logTelegramNotify(`⚡ Blockchain Dispatch: Initiating secure outbound gas routing for payouts...`);
        await new Promise(r => setTimeout(r, 1200)); // Simulate gas calculation

        const cryptoHash = '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
        setBlockchainHash(cryptoHash);
        logTelegramNotify(`⛓️ Smart Contract: Payout settled on BSC Network! Dispatch Block Hash: ${cryptoHash.slice(0, 12)}...`);
        await new Promise(r => setTimeout(r, 1000));
      }

      const txRef = doc(db, 'users', userUid, type === 'deposit' ? 'deposits' : 'withdrawals', txId);
      await setDoc(txRef, { status: action }, { merge: true });

      // Send email notification
      const user = allUsers.find(u => u.userId === userUid);
      if (user && user.email) {
        await fetch('/api/send-tx-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            userName: user.name,
            type,
            status: action,
            amount
          })
        }).catch(err => console.error("Failed to send notification email", err));
      }

      onAddToast(`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} status successfully updated to ${action}!`, 'success', type === 'deposit' ? 'deposit_submitted' : 'withdrawal_approved');
      logAuditAction(`Approved ${type} ID ${txId} for user ${userUid} with status: ${action}`, 'financial');
      logTelegramNotify(`🧾 Ledger Sync: ${type === 'deposit' ? 'Deposit' : 'Payout'} ${action} for ${userUid}.`);
      
      fetchAllData();
    } catch (e) {
      console.error("Action error:", e);
      onAddToast("Failed to verify transaction.", "error");
    } finally {
      setProcessingTxId(null);
    }
  };

  // Compute overall financial aggregation
  const globalAggregates = useMemo(() => {
    let totalUsersCount = allUsers.length;
    let totalDepositsSum = 0;
    let totalWithdrawalsSum = 0;
    let pendingDepositsSum = 0;
    let pendingWithdrawalsSum = 0;
    let totalReferralRewardsSum = 0;
    let totalInvestmentsSum = 0;
    let activeUsersCount = 0;

    allUsers.forEach(u => {
      if (!u.blocked) {
        activeUsersCount++;
      }

      const referralEarnings = u.referrals.reduce((sum, ref: any) => sum + (ref.amount !== undefined ? ref.amount : 0.055), 0);
      totalReferralRewardsSum += referralEarnings;

      u.deposits.forEach(d => {
        const amt = Number(d.amount) || 0;
        if (d.status === 'approved') {
          totalDepositsSum += amt;
        } else if (d.status === 'pending') {
          pendingDepositsSum += amt;
        }
      });

      u.withdrawals.forEach(w => {
        const amt = Number(w.amount) || 0;
        if (w.status === 'approved') {
          totalWithdrawalsSum += amt;
        } else if (w.status === 'pending') {
          pendingWithdrawalsSum += amt;
        }
      });
      
      u.investments.forEach(inv => {
        if (inv.status === 'active') {
          totalInvestmentsSum += Number(inv.amount) || 0;
        }
      });
    });

    const netReserves = totalDepositsSum - totalWithdrawalsSum;

    return {
      totalUsersCount,
      totalDepositsSum,
      totalWithdrawalsSum,
      pendingDepositsSum,
      pendingWithdrawalsSum,
      totalReferralRewardsSum,
      totalInvestmentsSum,
      activeUsersCount,
      netReserves
    };
  }, [allUsers]);

  // Compute charts data dynamically represent user signups and funding streams
  const chartData = useMemo(() => {
    // Generate simple dynamic chart items representing weeks or days
    return [
      { name: 'Onboarding Phase', Registrations: 3, Deposits: 15, Withdrawals: 0 },
      { name: 'Seed Phase', Registrations: 5, Deposits: 25, Withdrawals: 5 },
      { name: 'Multiplier Phase', Registrations: Math.max(12, allUsers.length - 2), Deposits: Math.max(75, globalAggregates.totalDepositsSum * 0.4), Withdrawals: Math.max(10, globalAggregates.totalWithdrawalsSum * 0.3) },
      { name: 'Live State Block', Registrations: allUsers.length, Deposits: globalAggregates.totalDepositsSum, Withdrawals: globalAggregates.totalWithdrawalsSum }
    ];
  }, [allUsers, globalAggregates]);

  // Filtered lists matching directory search
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchText.toLowerCase()) || 
                            u.userId.toLowerCase().includes(searchText.toLowerCase());
      return matchesSearch;
    });
  }, [allUsers, searchText]);

  const itemsPendingVerification = useMemo(() => {
    const list: { type: 'deposit' | 'withdrawal'; userUid: string; userName: string; data: any }[] = [];
    allUsers.forEach(u => {
      u.deposits.forEach(d => {
        list.push({ type: 'deposit', userUid: u.userId, userName: u.name, data: d });
      });
      u.withdrawals.forEach(w => {
        list.push({ type: 'withdrawal', userUid: u.userId, userName: u.name, data: w });
      });
    });
    return list;
  }, [allUsers]);

  const filteredVerificationItems = useMemo(() => {
    const list = itemsPendingVerification.filter(item => {
      // 1. Category Filter (deposits/withdrawals/all)
      if (filterType !== 'all') {
        if (filterType === 'deposits' && item.type !== 'deposit') return false;
        if (filterType === 'withdrawals' && item.type !== 'withdrawal') return false;
      }

      // 2. Status Filter
      if (filterWStatus !== 'all' && item.data.status !== filterWStatus) return false;

      // 3. Search text (matches userName, userUid, txHash, network, wallet address)
      if (txSearchText.trim() !== '') {
        const query = txSearchText.toLowerCase();
        const matchesName = (item.userName || '').toLowerCase().includes(query);
        const matchesUid = (item.userUid || '').toLowerCase().includes(query);
        const matchesHash = (item.data.txHash || '').toLowerCase().includes(query);
        const matchesWallet = (item.data.wallet || '').toLowerCase().includes(query);
        const matchesNetwork = (item.data.network || '').toLowerCase().includes(query);
        if (!matchesName && !matchesUid && !matchesHash && !matchesWallet && !matchesNetwork) {
          return false;
        }
      }

      // 4. Date Range Filter
      const txDateObj = item.data.createdAt?.seconds 
        ? new Date(item.data.createdAt.seconds * 1000) 
        : new Date(item.data.timestamp);

      if (txStartDate) {
        const start = new Date(txStartDate + 'T00:00:00');
        if (txDateObj < start) return false;
      }
      if (txEndDate) {
        const end = new Date(txEndDate + 'T23:59:59');
        if (txDateObj > end) return false;
      }

      return true;
    });

    // Sort newest first
    return list.sort((a, b) => {
      const aTime = a.data.createdAt?.seconds 
        ? a.data.createdAt.seconds * 1000 
        : new Date(a.data.timestamp).getTime() || 0;
      const bTime = b.data.createdAt?.seconds 
        ? b.data.createdAt.seconds * 1000 
        : new Date(b.data.timestamp).getTime() || 0;
      return bTime - aTime;
    });
  }, [itemsPendingVerification, filterType, filterWStatus, txSearchText, txStartDate, txEndDate]);

  // Render Login state first
  if (!isAdminAuthenticated) {
    return (
      <div 
        className="max-w-md mx-auto bg-[#111111] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 text-left shadow-2xl relative overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(212, 175, 55, 0.05) 0%, rgba(0, 0, 0, 0) 70%)'
        }}
      >
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-2xl flex items-center justify-center mx-auto text-[#D4AF37] shadow-xl">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold font-serif tracking-widest text-[#D4AF37] uppercase">Secure Admin Login 🔐</h2>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.1em]">MoneyMind Space Governance Protocol Console</p>
        </div>

        {authError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium">
            {authError}
          </div>
        )}

        <form onSubmit={handleAdminVerify} className="space-y-4 font-sans">
          <div className="space-y-1">
            <label className="text-[10px] text-white/50 uppercase tracking-wide font-semibold">Special Admin User ID</label>
            <input 
              type="text" 
              value={adminUserId} 
              onChange={e => setAdminUserId(e.target.value)}
              placeholder="e.g. danish"
              className="w-full bg-[#070707] border border-white/5 focus:border-[#D4AF37]/35 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-white/50 uppercase tracking-wide font-semibold">Secret Access Code</label>
            <input 
              type="password" 
              value={adminCode} 
              onChange={e => setAdminCode(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#070707] border border-white/5 focus:border-[#D4AF37]/35 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 outline-none transition-all"
            />
          </div>

          <button 
            type="submit"
            className="w-full mt-2 py-3 bg-gradient-to-r from-[#D4AF37] to-[#B29430] hover:brightness-110 active:scale-[0.98] transition-all rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-lg shadow-[#D4AF37]/10 cursor-pointer text-center"
          >
            Authenticate Security Session
          </button>
        </form>

        <div className="pt-4 border-t border-white/5 text-center">
          <p className="text-[9px] text-white/30 leading-relaxed font-sans">
            Authorized administrator logs are strictly audited. Access is restricted exclusively to the chief developer (Danish) using a private ID and code combination.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-left">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in">
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
              <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-white/30">
                <Users className="w-4 h-4" />
              </div>
              <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest font-sans">Total Users</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-white">{globalAggregates.totalUsersCount}</span>
              </div>
              <p className="text-[9px] text-white/25">Global premium user accounts</p>
            </div>

        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-emerald-400/20">
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest font-sans">Total Deposits</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-[#D4AF37]">${globalAggregates.totalDepositsSum.toFixed(2)}</span>
            {globalAggregates.pendingDepositsSum > 0 && (
              <span className="text-[8px] text-amber-500 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 block mt-1">
                +${globalAggregates.pendingDepositsSum.toFixed(0)} Pending Proofs
              </span>
            )}
          </div>
          <p className="text-[9px] text-emerald-400 font-medium">Approved funding capital</p>
        </div>

        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-rose-500/20">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="text-[9px] font-semibold text-[#E5E7EB]/40 uppercase tracking-widest font-sans">Total Withdrawals</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-400">${globalAggregates.totalWithdrawalsSum.toFixed(2)}</span>
            {globalAggregates.pendingWithdrawalsSum > 0 && (
              <span className="text-[8px] text-rose-500 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 block mt-1">
                +${globalAggregates.pendingWithdrawalsSum.toFixed(0)} Pending payout
              </span>
            )}
          </div>
          <p className="text-[9px] text-white/25">Disbursed audited payouts</p>
        </div>

        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-[#D4AF37]/20">
            <Zap className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest font-sans">Total Referral Rewards</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-indigo-400">${globalAggregates.totalReferralRewardsSum.toFixed(2)}</span>
          </div>
          <p className="text-[9px] text-white/25">Affiliate and level system payouts</p>
        </div>

        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-emerald-400/20">
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest font-sans">Active Users</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">{globalAggregates.activeUsersCount}</span>
          </div>
          <p className="text-[9px] text-white/25">Non-suspended standard accounts</p>
        </div>
      </div>

      {/* CHARTS & LIVE TELEGRAM SIMULATOR VIEW (BENTO ROW) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* RECHARTS CHANNELS */}
        <div className="lg:col-span-8 bg-[#111111] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Visual Analytics Graphs</h4>
              <p className="text-[9px] text-white/40 leading-relaxed">Platform performance metrics in real-time</p>
            </div>
            <button 
              onClick={fetchAllData}
              disabled={isDataLoading}
              className="p-1.5 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/5 text-white/60 hover:text-white transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-bold"
            >
              <RefreshCw className={`w-3 h-3 ${isDataLoading ? 'animate-spin' : ''}`} />
              Refresh Graph
            </button>
          </div>

          <div className="h-[240px] w-full pt-2 text-[10px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" />
                <YAxis stroke="rgba(255,255,255,0.2)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="Deposits" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorDeposits)" />
                <Area type="monotone" dataKey="Withdrawals" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#colorWithdrawals)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TELEGRAM SIMULATION & ANTI-FRAUD STATUS */}
        <div className="lg:col-span-4 bg-[#111111] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="space-y-0.5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse"></span>
                Telegram Live Webhook feed
              </h4>
              <p className="text-[9px] text-white/40">Simulating platform notification bot dispatchers</p>
            </div>

            <div className="bg-[#080808] border border-white/5 rounded-xl p-3 h-[180px] overflow-y-auto font-mono text-[9px] leading-relaxed text-indigo-300 space-y-1.5 select-all scrollbar-thin">
              {telegramLogs.length === 0 ? (
                <div className="p-4 text-center text-white/20 uppercase tracking-widest text-[8px] italic flex items-center justify-center h-full">
                  Waiting for system events to broadcast...
                </div>
              ) : (
                telegramLogs.map((log, index) => (
                  <div key={index} className="border-b border-white/[0.02] pb-1">
                    <span className="text-white/30 mr-1.5 hover:text-white transition-colors">[{log.time}]</span>
                    <span className="text-white/80">{log.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] text-white/40">
              <span>Security Engine</span>
              <span className="text-emerald-400 font-bold font-mono">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* ANTI-FRAUD CONCOURS PANELS */}
      {antiFraudFlags.length > 0 && (
        <div className="bg-[#1c1313] border border-rose-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            <h4 className="text-[10px] font-black uppercase tracking-widest">Platform Anti-Fraud Alarm triggers</h4>
            <span className="text-[9px] font-mono font-bold bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 rounded-full text-rose-400">{antiFraudFlags.length} Flags</span>
          </div>
          <div className="space-y-2">
            {antiFraudFlags.map((flag, idx) => (
              <div key={idx} className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center gap-3 text-xs font-sans text-white/80">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-[8px] font-bold tracking-widest uppercase text-rose-500">{flag.type}</p>
                  <p className="text-white/70 text-[10px]">{flag.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INCOMING MATRIX TRANSACTIONS ACTION DESK */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Administrative Verification Desk
            </h4>
            <p className="text-[9px] text-white/40">Audit incoming cash inputs and payouts across all registers</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-[#0A0A0A] border border-white/5 rounded-xl px-3 py-1.5 text-[10px] text-white uppercase outline-none focus:border-[#D4AF37]/35 cursor-pointer font-bold tracking-wider"
            >
              <option value="all">All Ledgers</option>
              <option value="deposits">Deposit Proofs</option>
              <option value="withdrawals">Withdrawal Payouts</option>
            </select>

            <select 
              value={filterWStatus} 
              onChange={e => setFilterWStatus(e.target.value as any)}
              className="bg-[#0A0A0A] border border-white/5 rounded-xl px-3 py-1.5 text-[10px] text-white uppercase outline-none focus:border-[#D4AF37]/35 cursor-pointer font-bold tracking-wider"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Verifications</option>
              <option value="approved">Approved Logs</option>
              <option value="rejected">Rejected Logs</option>
            </select>
          </div>
        </div>

        {/* Dynamic Search & Date-Range Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white/[0.01] border border-white/5 rounded-xl p-3 text-xs leading-relaxed font-sans">
          {/* Text Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/20" />
            <input 
              type="text" 
              placeholder="Search TX by Name, ID, hash, network..." 
              value={txSearchText}
              onChange={e => setTxSearchText(e.target.value)}
              className="w-full bg-[#070707] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[10px] text-white placeholder-white/30 outline-none focus:border-[#D4AF37]/30 transition-all font-medium font-sans"
            />
          </div>

          {/* Start Date Input */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <span className="text-[9px] text-white/30 uppercase tracking-wider shrink-0 font-bold font-sans">Start</span>
            <input 
              type="date"
              value={txStartDate}
              onChange={e => setTxStartDate(e.target.value)}
              className="w-full bg-[#070707] border border-white/5 rounded-xl px-2 py-1.5 text-[9px] text-white outline-none focus:border-[#D4AF37]/30 transition-all font-mono"
            />
          </div>

          {/* End Date Input */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <span className="text-[9px] text-white/30 uppercase tracking-wider shrink-0 font-bold font-sans">End</span>
            <input 
              type="date"
              value={txEndDate}
              onChange={e => setTxEndDate(e.target.value)}
              className="w-full bg-[#070707] border border-white/5 rounded-xl px-2 py-1.5 text-[9px] text-white outline-none focus:border-[#D4AF37]/30 transition-all font-mono"
            />
          </div>

          {/* Clear Button */}
          <div className="md:col-span-1 flex items-center justify-end">
            {(txSearchText || txStartDate || txEndDate || filterType !== 'all' || filterWStatus !== 'pending') && (
              <button
                onClick={() => {
                  setTxSearchText('');
                  setTxStartDate('');
                  setTxEndDate('');
                  setFilterType('all');
                  setFilterWStatus('pending');
                }}
                className="w-full md:w-auto text-[8px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-all active:scale-95 text-center font-sans"
                title="Reset Filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredVerificationItems.length === 0 ? (
          <div className="p-12 bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-center text-[10.5px] text-white/30 uppercase tracking-[0.2em] font-sans">
            No transaction records observed inside this view matching filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVerificationItems.map((item, idx) => {
              const isDeposit = item.type === 'deposit';
              const tx = item.data;
              const isProcessing = processingTxId === tx.id;

              return (
                <div key={idx} className="bg-[#070707] border border-white/5 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 font-sans text-xs">
                  <div className="space-y-1.5 flex-1 select-all">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        isDeposit 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                      }`}>
                        {isDeposit ? 'Inbound Deposit Proof' : 'Outbound Payout Request'}
                      </span>
                      <span className="text-white/50 font-mono text-[9.5px]">Claimant Name: <span className="text-white font-bold">{item.userName}</span> ({item.userUid})</span>
                      <span className="text-white/30 font-mono text-[9px]">{tx.timestamp}</span>
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-black font-mono text-white">${Number(tx.amount).toFixed(2)} USD value</span>
                      <span className="text-[10px] text-white/30 uppercase font-bold text-sans">via {tx.network} Cryptosphere</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest font-mono ${
                        tx.status === 'approved' 
                          ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20' 
                          : tx.status === 'rejected' 
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' 
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      }`}>
                        {tx.status}
                      </span>
                    </div>

                    <p className="text-[9px] font-mono text-white/40 break-all select-all">
                      {isDeposit 
                        ? `TXHash Identifier: ${tx.txHash}` 
                        : `Recipient Destination Wallet Address: ${tx.wallet}`
                      }
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 self-end lg:self-center">
                    {isProcessing && (
                      <div className="text-[9px] uppercase font-mono tracking-wider text-amber-500 animate-pulse flex items-center gap-1.5 mr-2">
                        <Clock className="w-3 h-3 animate-spin" />
                        Blockchain Syncing...
                      </div>
                    )}
                    
                    {tx.status === 'pending' ? (
                      <>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleAdminVerifyTx(item.type, item.userUid, tx.id, 'approved', Number(tx.amount), item.userName)}
                          className="w-full sm:w-auto px-4 py-2 rounded-lg border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/10 active:scale-95 transition-all text-[9px] font-black uppercase tracking-[0.15em] cursor-pointer disabled:opacity-50"
                        >
                          {isDeposit ? 'Approve Token Credit' : 'Disburse Outbound'}
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleAdminVerifyTx(item.type, item.userUid, tx.id, 'rejected', Number(tx.amount), item.userName)}
                          className="w-full sm:w-auto px-4 py-2 rounded-lg border border-rose-500/35 text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all text-[9px] font-black uppercase tracking-[0.15em] cursor-pointer disabled:opacity-50"
                        >
                          Deny / Flag Status
                        </button>
                      </>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                        tx.status === 'approved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                      }`}>
                        Action: {tx.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPREHENSIVE USERS REGISTRATION DIRECTORY */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Global User Directories Panel</h4>
            <p className="text-[9px] text-white/40">Audit profiles, trace transaction histories, and enforce site blockings</p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/20" />
            <input 
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search by ID or Username..."
              className="w-full bg-[#0A0A0A] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-[#D4AF37]/35 transition-all font-sans"
            />
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-white/30 uppercase tracking-widest block font-sans">
            No matching registered user files observed.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
            {filteredUsers.map((user, idx) => {
              const approvedD = user.deposits.filter(d => d.status === 'approved').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
              const approvedW = user.withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
              const referralEarnings = user.referrals.reduce((sum, ref: any) => sum + (ref.amount !== undefined ? ref.amount : 0.055), 0);

              const activeInvestmentsSum = user.investments
                .filter((i: any) => i.status === 'active')
                .reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);

              const investmentProfits = user.investments.reduce((sum: number, processPlan: any) => {
                let endTime = Date.now();
                if (processPlan.status === 'cancelled' && processPlan.cancelledAt) {
                  endTime = processPlan.cancelledAt?.seconds 
                    ? processPlan.cancelledAt.seconds * 1000 
                    : new Date(processPlan.cancelledAt).getTime() || Date.now();
                }

                const startTime = processPlan.createdAt?.seconds 
                  ? processPlan.createdAt.seconds * 1000 
                  : new Date(processPlan.timestamp).getTime() || Date.now();
                  
                const elapsedMs = Math.max(0, endTime - startTime);
                const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
                
                let percent = 0;
                if (processPlan.amount >= 100) percent = 7;
                else if (processPlan.amount >= 50) percent = 5;
                else if (processPlan.amount >= 15) percent = 4;
                else if (processPlan.amount >= 5) percent = 3;
                
                const dailyRate = processPlan.amount * (percent / 100);
                const profit = elapsedDaysReal * dailyRate;
                return sum + (profit > 0 ? profit : 0);
              }, 0);

              const calculatedBalance = user.signupBonus + referralEarnings + approvedD - approvedW + (user.dailyBonusEarnings || 0) + investmentProfits - activeInvestmentsSum;

              return (
                <div key={idx} className="bg-[#070707] border border-white/5 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20 text-[#D4AF37] font-serif font-black text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left leading-tight">
                          <p className="text-xs font-bold text-white leading-none">{user.name}</p>
                          <p className="text-[9px] text-[#D4AF37] font-mono mt-0.5 leading-none break-all max-w-[150px] sm:max-w-xs">{user.email || 'no-email@moneymindspace.com'}</p>
                          <p className="text-[8px] text-white/45 font-mono leading-none mt-1">ID: #{user.userId}</p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        user.blocked 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                      }`}>
                        {user.blocked ? 'BLOCKED' : 'ACTIVE'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 bg-white/[0.01] border border-white/5 rounded-lg px-2.5 text-[10px] font-mono leading-relaxed">
                      <div>
                        <span className="text-[8px] text-white/30 uppercase tracking-wide block leading-none mb-0.5">Balance</span>
                        <span className="text-emerald-400 font-bold">${calculatedBalance.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-white/30 uppercase tracking-wide block leading-none mb-0.5">Deposits</span>
                        <span className="text-white/80 font-bold">${approvedD.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-white/30 uppercase tracking-wide block leading-none mb-0.5">Withdrawals</span>
                        <span className="text-white/80 font-bold">${approvedW.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 leading-none gap-2 flex-wrap">
                    <span className="text-white/30 font-mono text-[9px]">Partners Joined: {user.referrals.length}</span>
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleToggleBlock(user.userId, user.blocked || false)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer border ${
                          user.blocked 
                            ? 'bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                            : 'bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 border-rose-500/25'
                        }`}
                      >
                        {user.blocked ? <Unlock className="w-2 h-2" /> : <Lock className="w-2 h-2" />}
                        {user.blocked ? 'Unsuspend' : 'Suspend'}
                      </button>

                      <button
                        onClick={() => handleDeleteUser(user.userId)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer border bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 border-rose-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADVANCED ANTI-FRAUD & MULTIPLE ACCOUNT DETECTION SYSTEM */}
      <div className="bg-[#111111]/90 border border-white/5 rounded-2xl p-6 space-y-6 relative overflow-hidden">
        {/* Visual background ambient color glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
              Advanced Anti-Fraud & Account Integrity Officer
            </h4>
            <p className="text-[9.5px] text-white/50">
              Heuristic validation of duplicate device registrations, referral loops, and blacklisted IPs.
            </p>
          </div>
          <div className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/25 rounded-md text-[8.5px] font-black uppercase tracking-wider text-rose-400">
             Shield Active
          </div>
        </div>

        {/* Override unban actions panel */}
        <div className="p-4 bg-black/65 border border-white/5 rounded-xl space-y-3">
          <div className="space-y-0.5">
            <h5 className="text-[10px] font-black uppercase tracking-wide text-white">
              Command Center: Manual Unban Override (انتظامیہ کے لیے شناختی بحالی)
            </h5>
            <p className="text-[9px] text-white/40">
              Enter any User ID, IP Address, or Device Fingerprint to lift bans immediately across the network.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. USER102, 192.168.1.1, or hash fingerprint..."
              value={overrideTarget}
              onChange={(e) => setOverrideTarget(e.target.value)}
              className="flex-1 bg-black/95 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 font-mono tracking-wide outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all shadow-inner"
            />
            <button
              onClick={() => handleManualOverrideUnban(overrideTarget)}
              disabled={overrideLoading}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-95 disabled:opacity-40 text-black text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-500/10"
            >
              {overrideLoading ? 'Unbanning...' : 'Manual Unban ✔'}
            </button>
          </div>
        </div>

        {/* Heurestic Category Widgets - 3 Column Bento layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* List Suspicious accounts & Banned */}
          <div className="bg-[#090909] border border-white/5 rounded-xl p-4 space-y-3">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] border-b border-white/5 pb-1.5 flex items-center justify-between">
              <span>Suspicious / Flagged User ID</span>
              <span className="bg-amber-500/10 px-1.5 py-0.5 rounded text-[8px] font-mono text-amber-400 font-bold">
                {allUsers.filter(u => u.isSuspicious).length} cases
              </span>
            </h5>
            <div className="h-[180px] overflow-y-auto space-y-2.5 scrollbar-thin">
              {allUsers.filter(u => u.isSuspicious).length === 0 ? (
                <div className="h-full flex items-center justify-center text-[9px] text-white/30 uppercase tracking-widest font-mono text-center p-6">
                  No flagged accounts currently
                </div>
              ) : (
                allUsers.filter(u => u.isSuspicious).map(u => (
                  <div key={u.userId} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col gap-1 text-[9.5px]">
                    <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
                      <span className="font-bold text-white tracking-wide">{u.name} ({u.userId})</span>
                      <span className="text-[7.5px] font-bold bg-[#D4AF37]/15 text-[#D4AF37] rounded px-1 uppercase tracking-wide">Suspicious</span>
                    </div>
                    <div className="text-white/50 text-[8.5px] font-mono space-y-0.5 px-1 pt-1">
                      <div>IP: {u.ipAddress || 'None'}</div>
                      <div className="truncate">Fingerprint: {u.deviceFingerprint || 'None'}</div>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-white/5 mt-1">
                      <span className="text-[8px] font-mono text-red-400 uppercase font-black">
                         {u.blocked ? 'Auto Banned' : 'Needs Review'}
                      </span>
                      <button
                        onClick={() => handleToggleBlock(u.userId, u.blocked || false)}
                        className={`px-2 py-1 text-[7.5px] font-black uppercase rounded ${
                          u.blocked ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                        }`}
                      >
                        {u.blocked ? 'Unban Match' : 'Ban User'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Duplicate Devices groups */}
          <div className="bg-[#090909] border border-white/5 rounded-xl p-4 space-y-3">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] border-b border-white/5 pb-1.5 flex items-center justify-between">
              <span>Duplicate Device Fingerprints</span>
              <span className="bg-amber-500/10 px-1.5 py-0.5 rounded text-[8px] font-mono text-amber-400 font-bold">
                Linked Phones
              </span>
            </h5>
            <div className="h-[180px] overflow-y-auto space-y-2.5 scrollbar-thin">
              {(() => {
                const groups: Record<string, typeof allUsers> = {};
                allUsers.forEach(u => {
                  if (u.deviceFingerprint && u.deviceFingerprint !== 'Not Fingerprinted' && u.deviceFingerprint.trim() !== '') {
                    if (!groups[u.deviceFingerprint]) groups[u.deviceFingerprint] = [];
                    groups[u.deviceFingerprint].push(u);
                  }
                });
                const duplicates = Object.entries(groups).filter(([fp, list]) => list.length > 1);

                if (duplicates.length === 0) {
                  return (
                    <div className="h-full flex items-center justify-center text-[9px] text-white/30 uppercase tracking-widest font-mono text-center p-6 bg-transparent">
                      Pure Integrity: Zero duplicate devices detected
                    </div>
                  );
                }

                return duplicates.map(([fp, list]) => (
                  <div key={fp} className="p-2.5 bg-rose-500/[0.02] border border-rose-500/10 rounded-lg flex flex-col gap-1.5 text-[9px] text-left">
                    <div className="font-mono text-[8px] text-rose-400 bg-rose-950/20 p-1 rounded truncate">FP: {fp}</div>
                    <div className="space-y-1">
                      <p className="text-white/30 text-[8px] uppercase tracking-wider font-bold">Associated Accounts ({list.length}):</p>
                      {list.map(u => (
                        <div key={u.userId} className="flex justify-between items-center text-white/70 font-mono">
                          <span>{u.name} ({u.userId})</span>
                          <span className={u.blocked ? 'text-red-400 text-[8px]' : 'text-emerald-400 text-[8px]'}>
                            {u.blocked ? 'Banned' : 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleManualOverrideUnban(fp)}
                      className="w-full mt-1.5 py-1 text-center font-bold font-sans text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded border border-emerald-500/25 text-[8.5px] uppercase active:scale-95 transition-all"
                    >
                      Restore All On Device
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Duplicate IP address trackers */}
          <div className="bg-[#090909] border border-white/5 rounded-xl p-4 space-y-3">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] border-b border-white/5 pb-1.5 flex items-center justify-between">
              <span>Duplicate Registers / IP Address</span>
              <span className="bg-amber-500/10 px-1.5 py-0.5 rounded text-[8px] font-mono text-amber-400 font-bold">
                IP Collisions
              </span>
            </h5>
            <div className="h-[180px] overflow-y-auto space-y-2.5 scrollbar-thin">
              {(() => {
                const groups: Record<string, typeof allUsers> = {};
                allUsers.forEach(u => {
                  if (u.ipAddress && u.ipAddress !== '192.168.1.100' && u.ipAddress.trim() !== '') {
                    if (!groups[u.ipAddress]) groups[u.ipAddress] = [];
                    groups[u.ipAddress].push(u);
                  }
                });
                const duplicates = Object.entries(groups).filter(([ip, list]) => list.length > 2); // Flag clusters of 3+ IP registrations as duplicate groups

                if (duplicates.length === 0) {
                  return (
                    <div className="h-full flex items-center justify-center text-[9px] text-white/30 uppercase tracking-widest font-mono text-center p-6 bg-transparent">
                      Secure IP clusters: No IP registration blocks flag required
                    </div>
                  );
                }

                return duplicates.map(([ip, list]) => (
                  <div key={ip} className="p-2.5 bg-rose-500/[0.02] border border-rose-500/10 rounded-lg flex flex-col gap-1.5 text-[9px] text-left">
                    <div className="font-mono text-[8.5px] text-zinc-300 bg-white/5 px-2 py-1 rounded">IP Address: {ip}</div>
                    <div className="space-y-1">
                      <p className="text-white/30 text-[8px] uppercase tracking-wider font-bold">Associated Accounts ({list.length}):</p>
                      {list.map(u => (
                        <div key={u.userId} className="flex justify-between items-center text-white/70">
                          <span>{u.name} ({u.userId})</span>
                          <span 
                            className={`${u.blocked ? 'text-rose-400 cursor-pointer hover:underline' : 'text-emerald-400'} text-[8px]`} 
                            onClick={() => handleToggleBlock(u.userId, u.blocked || false)}
                          >
                            {u.blocked ? 'Banned' : 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleManualOverrideUnban(ip)}
                      className="w-full mt-1.5 py-1 text-center font-bold font-sans text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded border border-emerald-500/25 text-[8.5px] uppercase active:scale-95 transition-all"
                    >
                      Unban All IP Matches
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>

        </div>

        {/* Security Logs list */}
        <div className="space-y-2.5 text-left">
          <div className="space-y-0.5 border-t border-white/5 pt-4">
            <h5 className="text-[10px] font-black uppercase text-white tracking-widest">
              Live Real-Time Security Logs Feed
            </h5>
            <p className="text-[9px] text-white/40">
              Live telemetry of anti-fraud violations, referral abuse blocks, and system security triggers.
            </p>
          </div>

          <div className="bg-[#070707] border border-white/5 rounded-xl max-h-[220px] overflow-y-auto divide-y divide-white/[0.02] select-all">
            {securityLogs.length === 0 ? (
              <div className="p-12 text-center text-[9px] font-mono text-white/20 uppercase tracking-widest leading-relaxed">
                No anti-fraud triggers or security logging events captured yet.
              </div>
            ) : (
              securityLogs.map((log, index) => (
                <div key={log.id || index} className="p-3 text-[9.5px] font-mono leading-relaxed text-left flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-wider shrink-0">
                        {log.type}
                      </span>
                      <span className="text-white/80 font-bold">{log.description}</span>
                    </div>
                    <span className="text-white/20 text-[8.5px]">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-white/40 text-[8.5px] shrink-0 font-mono px-3">
                    <span>IP Address: <span className="text-zinc-300">{log.ipAddress || 'Not Captured'}</span></span>
                    <span>Device FP: <span className="text-zinc-300">{log.deviceFingerprint ? log.deviceFingerprint.slice(0, 20) + '...' : 'Not Captured'}</span></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* AUDIT LOG PERSISTENT LEDGER */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="space-y-0.5">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] flex items-center gap-1.5">
            <Terminal className="w-4 h-4" />
            Persistent Platform Audit Log Ledger
          </h4>
          <p className="text-[9px] text-white/40">Secure administrative historical trailing ledger recorded on cloud nodes</p>
        </div>

        <div className="bg-[#070707] border border-white/5 rounded-xl h-[200px] overflow-y-auto select-all scrollbar-thin divide-y divide-white/[0.03]">
          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-[10px] font-mono text-white/20 uppercase tracking-widest leading-relaxed">
              No cloud audit logs captured. Syncing cloud ledger triggers.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-3 flex items-center justify-between gap-4 font-mono text-[9.5px] leading-relaxed">
                <div className="flex items-center gap-2.5">
                  <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                    log.type === 'auth' ? 'bg-[#D4AF37]' :
                    log.type === 'financial' ? 'bg-emerald-400' :
                    log.type === 'security' ? 'bg-rose-500' : 'bg-sky-400'
                  }`} />
                  <span className="text-white/30 shrink-0">[{log.time}]</span>
                  <span className="text-white/50 bg-white/5 px-1.5 py-0.5 rounded leading-none text-[8.5px] font-bold uppercase">{log.type}</span>
                  <span className="text-white/80">{log.action}</span>
                </div>
              </div>
            ))
          )}
      </div>
    </div>
  </div>
  );
}

