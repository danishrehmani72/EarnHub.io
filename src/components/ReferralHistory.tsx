/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ReferralLog } from '../types';
import { History, Share2, CornerDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarIcon, getAvatarConfig } from '../lib/avatars';

interface ReferralHistoryProps {
  logs: ReferralLog[];
}

export default function ReferralHistory({ logs }: ReferralHistoryProps) {
  return (
    <div className="w-full max-w-2xl bg-[#111111] rounded-3xl border border-white/5 p-6 md:p-8 space-y-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2.5 text-white/90">
          <History className="w-4 h-4 text-[#D4AF37]" />
          <h3 className="text-sm uppercase tracking-[0.2em] font-medium font-serif">Recent Referral Activity</h3>
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold bg-[#D4AF37]/10 text-[#D4AF37] px-3 py-1 rounded-full border border-[#D4AF37]/20">
          {logs.length} Conversions
        </span>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 space-y-3"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 text-white/20 border border-white/5">
                <Share2 className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">No Activity Yet</p>
                <p className="text-[11px] text-white/40 max-w-sm mx-auto mt-2 leading-relaxed">
                  Share your personal invitation link above. When individuals onboard using your link, they will appear here as real-time conversions.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10, y: -5 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-[#161616] border border-white/5 hover:border-[#D4AF37]/20 hover:bg-[#1C1C1C] transition-all duration-150"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                      getAvatarConfig(log.refereeAvatar).color
                    }`} title={getAvatarConfig(log.refereeAvatar).label}>
                      <AvatarIcon id={log.refereeAvatar} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-white/90">{log.referrerName}</span>
                        <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 border border-white/5">Joined</span>
                        {log.source && log.source !== 'default' && (
                          <span className="text-[8px] text-[#D4AF37] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                            via:{log.source}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-white/30 font-semibold tracking-wider uppercase mt-1">{log.timestamp}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-mono text-emerald-400 font-bold">
                      +${(log.amount !== undefined ? log.amount : 0.8).toFixed(2)}
                    </p>
                    <p className="text-[8px] text-emerald-400/60 tracking-widest font-semibold uppercase mt-0.5">Settled</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

