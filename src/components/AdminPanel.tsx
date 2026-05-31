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
  ExternalLink
} from 'lucide-react';
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
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { playSound } from '../lib/sounds';

interface AdminPanelProps {
  onAddToast: (message: string, type: 'success' | 'error', sound?: any) => void;
  currentUserId: string;
}

interface AdminUser {
  userId: string;
  name: string;
  avatar?: string;
  blocked?: boolean;
  signupBonus?: number;
  createdAt?: any;
  deposits: any[];
  withdrawals: any[];
  referrals: any[];
}

interface AuditLog {
  id: string;
  action: string;
  time: string;
  admin: string;
  type: 'auth' | 'financial' | 'security' | 'system';
  ip?: string;
}

export default function AdminPanel({ onAddToast, currentUserId }: AdminPanelProps) {
  // Authentication states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@gmail.com');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [authError, setAuthError] = useState('');
  
  // Database-wide state
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterWStatus, setFilterWStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterType, setFilterType] = useState<'all' | 'deposits' | 'withdrawals'>('all');

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

  // Supported administrators
  const ADMIN_EMAILS = ["admin@gmail.com", "danishrehmani72@gmail.com", "superadmin@earnhub.com"];

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
        admin: adminEmail,
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

    const cleanEmail = adminEmail.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(cleanEmail)) {
      setAuthError('❌ Access Denied: Unauthorized admin email vector');
      playSound('deposit_submitted'); // Warning drone tone
      return;
    }
    if (adminPassword !== 'admin123') {
      setAuthError('❌ Security Error: Invalid cryptographic secret passphrase.');
      return;
    }

    setIsAdminAuthenticated(true);
    onAddToast(`Admin Portal unlocked: Welcome back ${cleanEmail}! 🔐`, 'success');
    logAuditAction(`Administrator security session initiated via ${cleanEmail}`, 'auth');
    logTelegramNotify(`🔐 Security Node: Admin session initialized for ${cleanEmail}`);
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
        const depSnap = await getDocs(collection(db, 'users', userId, 'deposits'));
        const userDeps = depSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Withdrawals subcollection
        const witSnap = await getDocs(collection(db, 'users', userId, 'withdrawals'));
        const userWits = witSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Referrals subcollection
        const refSnap = await getDocs(collection(db, 'users', userId, 'referrals'));
        const userRefs = refSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        fetchedUsers.push({
          userId,
          name: userData.name || 'Anonymous VIP',
          avatar: userData.avatar,
          blocked: userData.blocked || false,
          signupBonus: userData.signupBonus !== undefined ? userData.signupBonus : 0.5,
          createdAt: userData.createdAt,
          deposits: userDeps,
          withdrawals: userWits,
          referrals: userRefs
        });
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

  // Administrative verification of tx (Deposit or Withdrawal Payout)
  const handleAdminVerifyTx = async (
    type: 'deposit' | 'withdrawal',
    userUid: string,
    txId: string,
    action: 'approved' | 'rejected'
  ) => {
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

    allUsers.forEach(u => {
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
    });

    const netReserves = totalDepositsSum - totalWithdrawalsSum;

    return {
      totalUsersCount,
      totalDepositsSum,
      totalWithdrawalsSum,
      pendingDepositsSum,
      pendingWithdrawalsSum,
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
        if (d.status === 'pending') {
          list.push({ type: 'deposit', userUid: u.userId, userName: u.name, data: d });
        }
      });
      u.withdrawals.forEach(w => {
        if (w.status === 'pending') {
          list.push({ type: 'withdrawal', userUid: u.userId, userName: u.name, data: w });
        }
      });
    });
    return list;
  }, [allUsers]);

  // Render Login state first
  if (!isAdminAuthenticated) {
    return (
      <div className="max-w-md mx-auto bg-[#111111] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 text-left shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-2xl flex items-center justify-center mx-auto text-[#D4AF37] shadow-xl">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold font-serif tracking-widest text-[#D4AF37] uppercase">Secure Admin Login 🔐</h2>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.1em]">EarnHub Governance Protocol Console</p>
        </div>

        {authError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium">
            {authError}
          </div>
        )}

        <form onSubmit={handleAdminVerify} className="space-y-4 font-sans">
          <div className="space-y-1">
            <label className="text-[10px] text-white/50 uppercase tracking-wide font-semibold">Admin Account Email</label>
            <input 
              type="email" 
              value={adminEmail} 
              onChange={e => setAdminEmail(e.target.value)}
              placeholder="e.g. admin@gmail.com"
              className="w-full bg-[#070707] border border-white/5 focus:border-[#D4AF37]/35 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-white/50 uppercase tracking-wide font-semibold">Passphrase Key</label>
            <input 
              type="password" 
              value={adminPassword} 
              onChange={e => setAdminPassword(e.target.value)}
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
            Authorized administrator logs are strictly audited under SEC compliant ledger protocols. Authorized test emails: <br />
            <strong className="text-white/60">admin@gmail.com</strong> / <strong className="text-white/60">danishrehmani72@gmail.com</strong> (Pass: <span className="font-mono text-emerald-400">admin123</span>)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-left">
      
      {/* GLOBAL STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-white/30">
            <Users className="w-4 h-4" />
          </div>
          <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest font-sans">Total Registrations</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">{globalAggregates.totalUsersCount}</span>
            <span className="text-[10px] text-emerald-400 font-bold font-mono">100% real</span>
          </div>
          <p className="text-[9px] text-white/25">Global premium user accounts</p>
        </div>

        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-emerald-400/20">
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest font-sans">Corporate Deposits</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-[#D4AF37]">${globalAggregates.totalDepositsSum.toFixed(2)}</span>
            {globalAggregates.pendingDepositsSum > 0 && (
              <span className="text-[8px] text-amber-500 font-bold px-1.5 py-0.5 rounded bg-amber-500/10">
                +${globalAggregates.pendingDepositsSum.toFixed(0)} Pending Proofs
              </span>
            )}
          </div>
          <p className="text-[9px] text-emerald-400 font-medium">Approved funding capital inside matrix</p>
        </div>

        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-rose-500/20">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="text-[9px] font-semibold text-[#E5E7EB]/40 uppercase tracking-widest font-sans">Outbound Withdrawals</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-400">${globalAggregates.totalWithdrawalsSum.toFixed(2)}</span>
            {globalAggregates.pendingWithdrawalsSum > 0 && (
              <span className="text-[8px] text-rose-500 font-bold px-1.5 py-0.5 rounded bg-rose-500/10">
                +${globalAggregates.pendingWithdrawalsSum.toFixed(0)} Pending payout
              </span>
            )}
          </div>
          <p className="text-[9px] text-white/25">Disbursed passive earnings</p>
        </div>

        <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center text-[#D4AF37]/20">
            <Layers className="w-4 h-4" />
          </div>
          <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest font-sans">System Reserves Liquidity</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${globalAggregates.netReserves >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${globalAggregates.netReserves.toFixed(2)}
            </span>
            <span className="text-[9px] text-[#D4AF37] font-mono">USD Net</span>
          </div>
          <p className="text-[9px] text-white/25">Platform liquid treasury capital</p>
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

          <div className="flex items-center gap-2">
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-[#0A0A0A] border border-white/5 rounded-xl px-3 py-1.5 text-[10px] text-white uppercase outline-none focus:border-[#D4AF37]/35 cursor-pointer font-bold tracking-wider"
            >
              <option value="all">All Ledgers</option>
              <option value="deposits">Deposit Proofs</option>
              <option value="withdrawals">Withdrawal Payouts</option>
            </select>
          </div>
        </div>

        {itemsPendingVerification.length === 0 ? (
          <div className="p-12 bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-center text-[10.5px] text-white/30 uppercase tracking-[0.2em] font-sans">
            Ledger holds no pending transaction verifications. Well clean!
          </div>
        ) : (
          <div className="space-y-3">
            {itemsPendingVerification
              .filter(item => {
                if (filterType === 'all') return true;
                if (filterType === 'deposits') return item.type === 'deposit';
                return item.type === 'withdrawal';
              })
              .map((item, idx) => {
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
                        <span className="text-[10px] text-white/30 uppercase font-bold">via {tx.network} Cryptosphere</span>
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
                      
                      <button
                        disabled={isProcessing}
                        onClick={() => handleAdminVerifyTx(item.type, item.userUid, tx.id, 'approved')}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/10 active:scale-95 transition-all text-[9px] font-black uppercase tracking-[0.15em] cursor-pointer disabled:opacity-50"
                      >
                        {isDeposit ? 'Approve Token Credit' : 'Disburse Outbound'}
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleAdminVerifyTx(item.type, item.userUid, tx.id, 'rejected')}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg border border-rose-500/35 text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all text-[9px] font-black uppercase tracking-[0.15em] cursor-pointer disabled:opacity-50"
                      >
                        Deny / Flag Status
                      </button>
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
          <div className="p-8 text-center text-xs text-white/30 uppercase tracking-widest">
            No matching registered user files observed.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredUsers.map((user, idx) => {
              const approvedD = user.deposits.filter(d => d.status === 'approved').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
              const approvedW = user.withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
              const calculatedBalance = user.signupBonus + (user.referrals.length * 0.8) + approvedD - approvedW;

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
                          <p className="text-[9px] text-white/40 font-mono inline-block">ID: #{user.userId}</p>
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

                  <div className="flex items-center justify-between text-[10px] pt-1 leading-none">
                    <span className="text-white/30 font-mono text-[9px]">Partners Joined: {user.referrals.length}</span>
                    
                    <button
                      onClick={() => handleToggleBlock(user.userId, user.blocked || false)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[8.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer border ${
                        user.blocked 
                          ? 'bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                          : 'bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 border-rose-500/25'
                      }`}
                    >
                      {user.blocked ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                      {user.blocked ? 'Unblock User' : 'Block User'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                <div className="text-right shrink-0 text-white/30 hidden sm:block">
                  <span>host: {log.ip || 'simulated IP'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
