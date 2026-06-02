/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ReferralLog } from '../types';
import { 
  History, 
  Share2, 
  Layers, 
  Users, 
  Copy, 
  Check, 
  TrendingUp, 
  CornerDownRight, 
  GitBranch, 
  Wallet,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarIcon, getAvatarConfig } from '../lib/avatars';

interface ReferralHistoryProps {
  logs: ReferralLog[];
  userId?: string;
  walletBalance?: number;
}

export default function ReferralHistory({ logs, userId = '', walletBalance = 0 }: ReferralHistoryProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'tree'>('overview');
  const [copied, setCopied] = useState(false);

  // Derive levels
  const level1Logs = logs.filter(log => !log.level || log.level === 1);
  const level2Logs = logs.filter(log => log.level === 2);
  const level3Logs = logs.filter(log => log.level === 3);

  const totalTeam = logs.length;
  const totalEarnings = logs.reduce((sum, log) => sum + (typeof log.amount === 'number' ? log.amount : 0.05), 0);

  // Construct sharing link
  const referralLink = `${window.location.origin}?ref=${userId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to build visual tree structure
  // We want to group by referrers starting with level 1.
  // Level 1: Users referred directly by current user (since they are level 1, they are directly under us)
  // Level 2: Users whose `referredBy` matches a Level 1 refereeId
  // Level 3: Users whose `referredBy` matches a Level 2 refereeId
  const treeLevelsInfo = {
    level1: level1Logs,
    level2: level2Logs,
    level3: level3Logs
  };

  return (
    <div className="w-full max-w-2xl bg-[#111111] rounded-3xl border border-white/5 p-6 md:p-8 space-y-6 shadow-2xl text-left" id="referral-system-container">
      {/* Header and Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white/90">
            <Layers className="w-4.5 h-4.5 text-[#D4AF37]" id="layers-icon" />
            <h3 className="text-sm uppercase tracking-[0.2em] font-medium font-serif">3-Level Alliance Matrix</h3>
          </div>
          <p className="text-[11px] text-white/40 font-sans leading-none">Complete decentralized direct & indirect team ledger tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest font-bold bg-[#D4AF37]/10 text-[#D4AF37] px-3 py-1 rounded-full border border-[#D4AF37]/15">
            Active Hub
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 pb-3 gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-[10.5px] uppercase tracking-wider font-extrabold rounded-lg transition-all duration-200 border ${
            activeTab === 'overview'
              ? 'bg-[#D4AF37]/5 border-[#D4AF37]/30 text-[#D4AF37]'
              : 'border-transparent text-white/40 hover:text-white/65 hover:bg-white/[0.02]'
          }`}
          id="tab-overview-btn"
        >
          Overview & Link
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-[10.5px] uppercase tracking-wider font-extrabold rounded-lg transition-all duration-200 border ${
            activeTab === 'logs'
              ? 'bg-[#D4AF37]/5 border-[#D4AF37]/30 text-[#D4AF37]'
              : 'border-transparent text-white/40 hover:text-white/65 hover:bg-white/[0.02]'
          }`}
          id="tab-logs-btn"
        >
          Referral History
        </button>
        <button
          onClick={() => setActiveTab('tree')}
          className={`px-4 py-2 text-[10.5px] uppercase tracking-wider font-extrabold rounded-lg transition-all duration-200 border ${
            activeTab === 'tree'
              ? 'bg-[#D4AF37]/5 border-[#D4AF37]/30 text-[#D4AF37]'
              : 'border-transparent text-white/40 hover:text-white/65 hover:bg-white/[0.02]'
          }`}
          id="tab-tree-btn"
        >
          Team Tree View
        </button>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="referral-stats">
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-4 space-y-1">
                <span className="text-[9px] text-white/30 uppercase tracking-widest font-semibold block leading-none">Wallet Balance</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <Wallet className="w-3.5 h-3.5 text-[#D4AF37]/75" />
                  <span className="text-sm font-semibold text-white font-mono">${walletBalance.toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-4 space-y-1">
                <span className="text-[9px] text-white/30 uppercase tracking-widest font-semibold block leading-none">Total Team Matrix</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <Users className="w-3.5 h-3.5 text-[#D4AF37]/75" />
                  <span className="text-sm font-semibold text-white font-mono">{totalTeam} Users</span>
                </div>
              </div>
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-4 space-y-1 col-span-2">
                <span className="text-[9px] text-white/30 uppercase tracking-widest font-semibold block leading-none">Total Reward Earnings</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400 font-mono">+${totalEarnings.toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            {/* Level Breakdown Charts */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#161616]/50 border border-white/5 rounded-xl p-3.5 text-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-[#D4AF37]/40" />
                <span className="text-[8px] text-white/30 uppercase tracking-[0.15em] font-semibold block">Level 1 (Direct)</span>
                <span className="text-lg font-bold text-white font-mono block mt-1">{level1Logs.length}</span>
                <span className="text-[8.5px] text-[#D4AF37] font-mono font-black mt-1 block bg-[#D4AF37]/5 py-0.5 rounded-sm uppercase">$0.05 / ref</span>
              </div>
              <div className="bg-[#161616]/50 border border-white/5 rounded-xl p-3.5 text-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-indigo-500/40" />
                <span className="text-[8px] text-white/30 uppercase tracking-[0.15em] font-semibold block">Level 2 (Indirect)</span>
                <span className="text-lg font-bold text-white font-mono block mt-1">{level2Logs.length}</span>
                <span className="text-[8.5px] text-indigo-400 font-mono font-black mt-1 block bg-indigo-500/5 py-0.5 rounded-sm uppercase">$0.03 / ref</span>
              </div>
              <div className="bg-[#161616]/50 border border-white/5 rounded-xl p-3.5 text-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-sky-500/40" />
                <span className="text-[8px] text-white/30 uppercase tracking-[0.15em] font-semibold block">Level 3 (Indirect)</span>
                <span className="text-lg font-bold text-white font-mono block mt-1">{level3Logs.length}</span>
                <span className="text-[8.5px] text-sky-400 font-mono font-black mt-1 block bg-sky-500/5 py-0.5 rounded-sm uppercase">$0.01 / ref</span>
              </div>
            </div>

            {/* Referral Sharing Box */}
            <div className="bg-[#161616] border border-[#D4AF37]/10 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="text-xs font-bold text-white/90">Your Personal Invitation Key</span>
                </div>
                <span className="text-[8px] tracking-widest text-[#D4AF37] uppercase font-bold px-2 py-0.5 rounded-md bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                  Instant Payout Link
                </span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Distribute this unique code below to peers. When people join, they immediately claim a **$0.30 registered bonus** (instead of standard $0.10), and your hub maps up to 3 tiers of ongoing payout commissions.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-xs text-white/80 font-mono tracking-tight cursor-default focus:outline-none focus:border-[#D4AF37]/40 text-ellipsis overflow-hidden"
                  id="referral-link-input"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#Bfa032] text-black font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(212,175,55,0.15)] select-none cursor-pointer"
                  id="copy-referral-btn"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Anti Fraud Box Info */}
            <div className="flex gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl text-[10.5px] text-white/40 leading-relaxed font-sans mt-2">
              <ShieldAlert className="w-4 h-4 text-[#D4AF37]/70 shrink-0 mt-0.5" />
              <div>
                <span className="text-white/70 font-semibold block mb-0.5">Automated Fraud Mitigation Guard</span>
                Multiple accounts per email or hardware device index, duplicate referral self-onboarding loops, and cyclic replication is constantly analyzed. Any flagged violations block withdrawals instantly.
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="max-h-[350px] overflow-y-auto scrollbar-thin pr-1">
              {logs.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 text-white/20 border border-white/5">
                    <History className="w-5 h-5 text-white/30" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">No Conversions Detected</p>
                    <p className="text-[11px] text-white/30 max-w-sm mx-auto mt-2 leading-relaxed">
                      Your referral tree is pristine. Share your invite node link to start earning direct level bonuses instantly.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => {
                    const levelNum = log.level || 1;
                    const levelColors = levelNum === 1 
                      ? { text: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/5 border-[#D4AF37]/15', label: 'Level 1 (Direct)' }
                      : levelNum === 2 
                      ? { text: 'text-indigo-400', bg: 'bg-indigo-500/5 border-indigo-500/15', label: 'Level 2 (Indirect)' }
                      : { text: 'text-sky-400', bg: 'bg-sky-500/5 border-sky-500/15', label: 'Level 3 (Indirect)' };

                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-[#161616] border border-white/5 hover:border-[#D4AF37]/15 transition-all duration-150"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-[#D4AF37]">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{log.refereeName || log.referrerName || 'Anonymous Partner'}</span>
                              <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${levelColors.bg} ${levelColors.text}`}>
                                {levelColors.label}
                              </span>
                            </div>
                            <p className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mt-1">{log.timestamp}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-mono text-emerald-400 font-extrabold">
                            +${(log.amount !== undefined ? log.amount : (levelNum === 1 ? 0.05 : levelNum === 2 ? 0.03 : 0.01)).toFixed(2)}
                          </p>
                          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest block mt-0.5">Sponsor Payout</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'tree' && (
          <motion.div
            key="tree"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="bg-[#141414] p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-xs font-bold text-white">Your Decentered Genealogy Tree</span>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed mb-4">
                Interactive mapping of Tier-1, Tier-2, and Tier-3 referral members underneath your custom node in sequential tree.
              </p>

              {level1Logs.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-[11px] uppercase tracking-wider">
                  No registered members inside your structure to draw a tree view.
                </div>
              ) : (
                <div className="space-y-4 font-sans max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
                  {/* Tree Core Node representing Current User */}
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-2 max-w-[200px] shadow-sm relative">
                    <div className="w-5 h-5 rounded bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/20 text-[9px] font-black">
                      YOU
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-white/80 uppercase block tracking-wider">Master Agent Node</span>
                      <span className="text-[8.5px] font-mono text-[#D4AF37] block">ID: {userId || 'self'}</span>
                    </div>
                  </div>

                  {/* Level 1 Loop */}
                  <div className="pl-4 space-y-4 border-l border-white/5 relative">
                    {level1Logs.map((lvl1) => {
                      // Filter level 2 children whose referrer matches this level 1 referee
                      const level2Children = level2Logs.filter(lvl2 => lvl2.referredBy === lvl1.refereeId);

                      return (
                        <div key={lvl1.id} className="space-y-3 pt-1">
                          {/* Lvl 1 Node Card */}
                          <div className="flex items-center gap-2 relative">
                            <CornerDownRight className="w-3.5 h-3.5 text-[#D4AF37]/30 shrink-0 absolute -left-4 top-1.5" />
                            <div className="flex-1 bg-[#1A1A1A] border border-[#D4AF37]/15 rounded-xl p-3 flex items-center justify-between shadow-inner ml-1.5 max-w-md">
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded flex items-center justify-center border border-white/10 bg-white/5 text-[#D4AF37] text-[10px]">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <span className="text-[10.5px] font-extrabold text-white block">{lvl1.refereeName}</span>
                                  <span className="text-[8.5px] text-white/30 uppercase tracking-widest font-semibold block mt-0.5">Tier 1 Agent</span>
                                </div>
                              </div>
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/5 px-2 py-0.5 rounded border border-emerald-400/10 font-black">+$0.05</span>
                            </div>
                          </div>

                          {/* Level 2 Loop */}
                          {level2Children.length > 0 && (
                            <div className="pl-10 space-y-3 border-l border-white/5 ml-4 relative">
                              {level2Children.map((lvl2) => {
                                // Filter level 3 children whose referrer matches this level 2 referee
                                const level3Children = level3Logs.filter(lvl3 => lvl3.referredBy === lvl2.refereeId);

                                return (
                                  <div key={lvl2.id} className="space-y-3 pt-1">
                                    {/* Lvl 2 Node Card */}
                                    <div className="flex items-center gap-2 relative">
                                      <CornerDownRight className="w-3.5 h-3.5 text-indigo-500/30 shrink-0 absolute -left-4 top-1.5" />
                                      <div className="flex-1 bg-[#1A1A1A] border border-indigo-500/15 rounded-xl p-3 flex items-center justify-between shadow-inner ml-1.5 max-w-sm">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-6 h-6 rounded flex items-center justify-center border border-white/10 bg-white/5 text-[#D4AF37] text-[10px]">
                                            <User className="w-3.5 h-3.5" />
                                          </div>
                                          <div>
                                            <span className="text-[10.5px] font-extrabold text-white block">{lvl2.refereeName}</span>
                                            <span className="text-[8.5px] text-white/30 uppercase tracking-widest font-semibold block mt-0.5">Tier 2 Agent</span>
                                          </div>
                                        </div>
                                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/5 px-2 py-0.5 rounded border border-emerald-400/10 font-black">+$0.03</span>
                                      </div>
                                    </div>

                                    {/* Level 3 Loop */}
                                    {level3Children.length > 0 && (
                                      <div className="pl-10 space-y-2 border-l border-white/5 ml-4 relative">
                                        {level3Children.map((lvl3) => (
                                          <div key={lvl3.id} className="flex items-center gap-2 pt-1 relative">
                                            <CornerDownRight className="w-3.5 h-3.5 text-sky-500/30 shrink-0 absolute -left-4 top-1.5" />
                                            <div className="flex-1 bg-[#1A1A1A] border border-sky-400/15 rounded-xl p-2.5 flex items-center justify-between shadow-sm ml-1.5 max-w-xs">
                                              <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded flex items-center justify-center border border-white/10 bg-white/5 text-[#D4AF37] text-[9px]">
                                                  <User className="w-3 h-3" />
                                                </div>
                                                <div>
                                                  <span className="text-[10px] font-extrabold text-white/80 block leading-none">{lvl3.refereeName}</span>
                                                  <span className="text-[8px] text-white/30 uppercase tracking-widest font-semibold block mt-0.5 leading-none">Tier 3 Associate</span>
                                                </div>
                                              </div>
                                              <span className="text-[8.5px] font-mono text-emerald-405 bg-emerald-400/5 px-1.5 py-0.5 rounded border border-emerald-400/10 font-bold text-emerald-400">+$0.01</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
