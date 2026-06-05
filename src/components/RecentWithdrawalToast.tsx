import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';

const USERS = [
  "A*** K***",
  "M*** A***",
  "U*** H***",
  "R*** K***",
  "S*** A***",
  "H*** A***",
  "F*** M***",
  "B*** A***"
];

const AMOUNTS = [
  "$10.00",
  "$20.00",
  "$30.00",
  "$50.00",
  "$75.00",
  "$100.00",
  "$150.00"
];

const METHODS = [
  "EasyPaisa",
  "JazzCash",
  "Binance"
];

const TIMES = [
  "Just now",
  "1 minute ago",
  "2 minutes ago",
  "5 minutes ago",
  "8 minutes ago"
];

export default function RecentWithdrawalToast() {
  const [show, setShow] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [currentMethod, setCurrentMethod] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const loadRandomData = () => {
    const user = USERS[Math.floor(Math.random() * USERS.length)];
    const amount = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
    const method = METHODS[Math.floor(Math.random() * METHODS.length)];
    const time = TIMES[Math.floor(Math.random() * TIMES.length)];

    setCurrentUser(user);
    setCurrentAmount(amount);
    setCurrentMethod(method);
    setCurrentTime(time);
  };

  useEffect(() => {
    // Show first popup after 30 seconds as requested
    const initialDelay = setTimeout(() => {
      loadRandomData();
      setShow(true);

      // Hide after 6 seconds
      const hideTimer = setTimeout(() => {
        setShow(false);
      }, 6000);

      return () => clearTimeout(hideTimer);
    }, 30000);

    // Then repeated interval timer every 30 seconds
    const interval = setInterval(() => {
      loadRandomData();
      setShow(true);

      // Hide after 6 seconds
      setTimeout(() => {
        setShow(false);
      }, 6000);
    }, 30000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -50, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          className="fixed bottom-24 left-4 sm:bottom-6 sm:left-6 z-[99999] w-[320px] overflow-hidden rounded-2xl bg-[#0F0F0F]/95 border-l-4 border-l-[#10B981] border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl p-4 flex flex-col gap-3.5"
        >
          {/* Subtle status pulsing point */}
          <div className="absolute top-2 right-2.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="text-[7px] text-[#10B981] font-black uppercase tracking-wider">SECURE PAYOUT</span>
          </div>

          <div className="flex gap-3 items-center relative">
            {/* Visual Icon with rotating/shining effect */}
            <div className="relative flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B981]/25 to-black border border-[#10B981]/40 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              💸
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border border-black scale-90">
                <Check className="w-2.5 h-2.5 text-black stroke-[3.5]" />
              </span>
            </div>

            <div className="flex-1 text-left min-w-0 pr-4">
              <p className="text-white text-xs font-semibold leading-relaxed leading-snug">
                <span className="text-zinc-300 font-extrabold">{currentUser}</span> successfully withdrew <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-[#D4AF37] to-emerald-400 font-black font-mono">{currentAmount}</span> via <span className="text-[#D4AF37] font-extrabold uppercase text-[10px] tracking-wider bg-[#D4AF37]/10 px-1.5 py-0.5 rounded border border-[#D4AF37]/20">{currentMethod}</span>
              </p>
              <span className="text-[10px] text-zinc-500 font-medium font-sans flex items-center gap-1 mt-1">
                ⏱ {currentTime}
              </span>
            </div>

            {/* Dismiss Cross Button icon */}
            <button
              onClick={() => setShow(false)}
              className="absolute -top-1 right-0 text-zinc-500 hover:text-white transition-all p-1 rounded-full bg-white/5 hover:bg-white/10"
              aria-label="Dismiss payout notice"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          {/* Visual remaining time line indicator at the bottom */}
          <div className="w-full bg-white/5 h-[2px] rounded-full overflow-hidden absolute bottom-0 left-0 right-0">
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 6, ease: "linear" }}
              className="h-full bg-gradient-to-r from-[#10B981] to-[#D4AF37]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
