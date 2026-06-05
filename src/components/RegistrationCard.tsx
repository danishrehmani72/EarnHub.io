/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserPlus, Sparkles, TrendingUp, HelpCircle, Key, LogIn, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import earnhubLogo from '../assets/images/earnhub_logo_1780161493423.png';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, collection, getDocFromServer } from 'firebase/firestore';

const getDocWithRetry = async (docRef: any, maxRetries = 2): Promise<any> => {
  let attempt = 0;
  while (true) {
    try {
      return await getDoc(docRef);
    } catch (err: any) {
      attempt++;
      const isOffline = err.message && err.message.toLowerCase().includes('offline');
      if (isOffline && attempt <= maxRetries) {
        console.warn(`Firestore getDoc offline warning, retrying attempt ${attempt}...`);
        try {
          return await getDocFromServer(docRef);
        } catch (serverErr) {
          // fallback to standard delay or error propagation
        }
        await new Promise((res) => setTimeout(res, 600 * attempt));
        continue;
      }
      throw err;
    }
  }
};

interface RegistrationCardProps {
  referredBy: string | null;
  referredSource?: string | null;
  inviterName: string | null;
  onLoginSuccess: (userId: string) => void;
}

export default function RegistrationCard({ referredBy, referredSource, inviterName, onLoginSuccess }: RegistrationCardProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('crown');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Process Signup Form Submission
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!userId.trim()) {
      setError('Please select a unique User ID.');
      return;
    }
    if (userId.includes(' ')) {
      setError('User ID cannot contain space characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-.@]+$/.test(userId.trim())) {
      setError('User ID can only contain letters, numbers, underscores, hyphens, dots, or @ symbols.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    const cleanUserId = userId.trim().toLowerCase();
    const cleanName = name.trim();

    try {
      // 1. Check if the User profile document already exists in Firestore to prevent collision
      const userRef = doc(db, 'users', cleanUserId);
      const userSnap = await getDocWithRetry(userRef);
      if (userSnap.exists()) {
        setError('This User ID is already occupied by another VIP member.');
        setIsLoading(false);
        return;
      }

      // Determine signup bonus: standard is $0.10, but if referred by a valid user, they get $0.30 (invitee bonus)
      let signupBonusAmount = 0.10;
      let isReferralValid = false;

      if (referredBy && referredBy !== cleanUserId) {
        try {
          const inviterRef = doc(db, 'users', referredBy);
          const inviterSnap = await getDocWithRetry(inviterRef);
          if (inviterSnap.exists()) {
            isReferralValid = true;
            signupBonusAmount = 0.30;
          }
        } catch (inviteErr) {
          console.warn('Silent invitation tracking failure verification:', inviteErr);
        }
      }

      // 2. Store full profile database record in Firestore under the custom User ID
      await setDoc(userRef, {
        userId: cleanUserId,
        name: cleanName,
        avatar: selectedAvatar,
        signupBonus: signupBonusAmount,
        referredBy: isReferralValid ? referredBy : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Store authentication credentials securely in the private secrets subcollection doc
      const secretsRef = doc(db, 'users', cleanUserId, 'secrets', 'auth');
      await setDoc(secretsRef, {
        password: password,
      });

      // 4. Handle conversion ledger event if user joined via valid referrer invite link
      if (isReferralValid && referredBy) {
        try {
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

          // Level 1 Reward ($0.05)
          const level1LogRef = doc(collection(db, 'users', referredBy, 'referrals'));
          await setDoc(level1LogRef, {
            id: level1LogRef.id,
            timestamp: timestampStr,
            amount: 0.05,
            level: 1,
            refereeId: cleanUserId,
            refereeName: cleanName,
            refereeAvatar: selectedAvatar,
            source: referredSource || 'default',
            referredBy: referredBy,
            createdAt: serverTimestamp(),
          });

          // Fetch Level 1 parent elements to check for Level 2 Parent
          const parent1Ref = doc(db, 'users', referredBy);
          const parent1Snap = await getDocWithRetry(parent1Ref);
          if (parent1Snap.exists()) {
            const parent1Data = parent1Snap.data();
            const parent2Id = parent1Data.referredBy; // Level 2 Parent

            if (parent2Id && parent2Id !== cleanUserId) {
              const parent2Ref = doc(db, 'users', parent2Id);
              const parent2Snap = await getDocWithRetry(parent2Ref);
              if (parent2Snap.exists()) {
                // Level 2 Reward ($0.03)
                const level2LogRef = doc(collection(db, 'users', parent2Id, 'referrals'));
                await setDoc(level2LogRef, {
                  id: level2LogRef.id,
                  timestamp: timestampStr,
                  amount: 0.03,
                  level: 2,
                  refereeId: cleanUserId,
                  refereeName: cleanName,
                  refereeAvatar: selectedAvatar,
                  source: referredSource || 'default',
                  referredBy: referredBy,
                  createdAt: serverTimestamp(),
                });

                const parent2Data = parent2Snap.data();
                const parent3Id = parent2Data.referredBy; // Level 3 Parent

                if (parent3Id && parent3Id !== cleanUserId && parent3Id !== parent2Id) {
                  const parent3Ref = doc(db, 'users', parent3Id);
                  const parent3Snap = await getDocWithRetry(parent3Ref);
                  if (parent3Snap.exists()) {
                    // Level 3 Reward ($0.01)
                    const level3LogRef = doc(collection(db, 'users', parent3Id, 'referrals'));
                    await setDoc(level3LogRef, {
                      id: level3LogRef.id,
                      timestamp: timestampStr,
                      amount: 0.01,
                      level: 3,
                      refereeId: cleanUserId,
                      refereeName: cleanName,
                      refereeAvatar: selectedAvatar,
                      source: referredSource || 'default',
                      referredBy: parent2Id,
                      createdAt: serverTimestamp(),
                    });
                  }
                }
              }
            }
          }
        } catch (inviteErr) {
          console.warn('Silent invitation tracking failure:', inviteErr);
        }
      }

      // 5. Highlight beautiful feedback and transition to login box
      setSuccessMsg('✅ Successfully Registered!');
      
      setTimeout(() => {
        setMode('login');
        setSuccessMsg('');
        setPassword(''); // Clear security fields
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  };

  // Process Login Form Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId.trim()) {
      setError('Please enter your User ID.');
      return;
    }
    if (!password) {
      setError('Please provide your secure password.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    const cleanUserId = userId.trim().toLowerCase();

    try {
      // 1. Fetch user profile
      const userRef = doc(db, 'users', cleanUserId);
      const userSnap = await getDocWithRetry(userRef);
      if (!userSnap.exists()) {
        setError('❌ Invalid User ID or Password');
        setIsLoading(false);
        return;
      }

      // 2. Fetch secure credentials check to authenticate custom login session
      const secretsRef = doc(db, 'users', cleanUserId, 'secrets', 'auth');
      const secretsSnap = await getDocWithRetry(secretsRef);
      
      if (!secretsSnap.exists() || secretsSnap.data().password !== password) {
        setError('❌ Invalid User ID or Password');
        setIsLoading(false);
        return;
      }

      setSuccessMsg('🎉 Login Successful!');
      localStorage.setItem('earnhub_logged_in_uid', cleanUserId);
      
      setTimeout(() => {
        onLoginSuccess(cleanUserId);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      const isPermissionErr = err.message && (
        err.message.toLowerCase().includes('permission') || 
        err.message.toLowerCase().includes('insufficient')
      );
      if (isPermissionErr) {
        setError('❌ Invalid User ID or Password format');
      } else {
        setError(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0B0B0B] via-[#050505] to-black border-2 border-[#D4AF37]/45 hover:border-[#10B981]/60 shadow-[0_0_40px_rgba(212,175,55,0.12)] hover:shadow-[0_0_55px_rgba(16,185,129,0.18)] transition-all duration-500 p-6 md:p-8 space-y-7 max-w-md w-full backdrop-blur-xl"
    >
      {/* Premium gold particle overlay gradients */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#D4AF37]/8 via-[#10B981]/4 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-[#D4AF37]/5 blur-3xl pointer-events-none" />

      {/* Header section with brand logo */}
      <div className="text-center space-y-2 relative z-10">
        <img 
          src={earnhubLogo}
          alt="MoneyMind Space Gold Premium Logo"
          className="w-16 h-16 mx-auto object-contain rounded-2xl border-2 border-[#D4AF37]/40 ring-1 ring-[#D4AF37]/15 shadow-[0_0_20px_rgba(212,175,55,0.15)] bg-black mb-3"
          referrerPolicy="no-referrer"
        />
        <h2 className="text-base font-black uppercase tracking-[0.14em] text-white font-serif leading-none">
          {mode === 'signup' ? (
            <>Join <span className="text-[#D4AF37] animate-pulse">MoneyMind Space</span></>
          ) : (
            <>Welcome to <span className="text-[#D4AF37] animate-pulse">MoneyMind Space</span></>
          )}
        </h2>
        <p className="text-[11px] text-white/50 leading-relaxed font-sans max-w-xs mx-auto">
          {mode === 'signup' 
            ? 'Create secure, real-time credentials to unlock professional distribution and payout audits.' 
            : 'Access your private dashboard to monitor balance matrices and secure transaction ledger pipelines.'}
        </p>
      </div>

      {/* Dynamic Tabs/Toggles with custom state styling */}
      <div className="grid grid-cols-2 gap-1.5 bg-black/80 p-1.5 rounded-2xl border border-[#D4AF37]/30 shadow-inner shadow-black relative z-10">
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError('');
            setSuccessMsg('');
          }}
          className={`py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer ${
            mode === 'signup' 
              ? 'bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)] font-black' 
              : 'text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
          }`}
        >
          Sign Up
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError('');
            setSuccessMsg('');
          }}
          className={`py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer ${
            mode === 'login' 
              ? 'bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)] font-black' 
              : 'text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
          }`}
        >
          Sign In
        </button>
      </div>

      <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} className="space-y-4 relative z-10 text-left">
        {/* User ID Field */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">👤</span>
            <label htmlFor="userid-input" className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
              VIP User ID
            </label>
          </div>
          <div className="relative">
            <input
              id="userid-input"
              type="text"
              placeholder="e.g. Alexmiller123"
              value={userId}
              onChange={(e) => {
                const cleanVal = e.target.value.replace(/\s+/g, '');
                setUserId(cleanVal);
                if (cleanVal) setError('');
              }}
              className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 select-all outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black"
            />
          </div>
          {mode === 'signup' && (
            <p className="mt-1 text-[8.5px] text-white/30 font-medium tracking-wide">Your User ID is your secure login key: <span className="text-[#D4AF37]/80 font-mono font-bold">{userId ? userId : 'id'}</span></p>
          )}
        </div>

        {/* Full Name Field (Signup only) */}
        <AnimatePresence mode="popLayout">
          {mode === 'signup' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📝</span>
                <label htmlFor="name-input" className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                  Full Name of Member
                </label>
              </div>
              <input
                id="name-input"
                type="text"
                placeholder="e.g. Alex Miller"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setError('');
                }}
                className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 select-all outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Secure Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">🔑</span>
            <label htmlFor="password-input" className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
              Secure Password
            </label>
          </div>
          <div className="relative">
            <input
              id="password-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (e.target.value) setError('');
              }}
              className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 select-all outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black"
            />
          </div>
        </div>

        {/* Feedback Messages */}
        {error && (
          <p className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
            <span>⚠️ Error:</span>
            <span>{error}</span>
          </p>
        )}

        {successMsg && (
          <p className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
            <span>✅ Success:</span>
            <span>{successMsg}</span>
          </p>
        )}

        {/* Submit Actions */}
        <button
          type="submit"
          disabled={isLoading}
          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] bg-[length:200%_auto] hover:bg-right text-black shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:shadow-[0_0_45px_rgba(212,175,55,0.6)] active:scale-[0.98] transition-all duration-500 font-black text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              <span>Processing Onboard...</span>
            </>
          ) : mode === 'signup' ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span>🚀 Sign Up & Onboard</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>🔑 Sign In directly</span>
            </>
          )}
        </button>
      </form>

      {/* Alternative View triggers */}
      <div className="text-center relative z-10">
        {mode === 'signup' ? (
          <button
            type="button"
            onClick={() => setMode('login')}
            className="text-[9.5px] text-white/50 uppercase tracking-widest font-black hover:text-[#D4AF37] transition-all cursor-pointer underline decoration-[#D4AF37]/35 decoration-2"
          >
            Already have an account? Sign In
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode('signup')}
            className="text-[9.5px] text-white/50 uppercase tracking-widest font-black hover:text-[#D4AF37] transition-all cursor-pointer underline decoration-[#D4AF37]/35 decoration-2"
          >
            Don't have an account? Sign Up
          </button>
        )}
      </div>

      <div className="pt-5 border-t border-white/5 space-y-4 text-left relative z-10 font-sans">
        <div className="flex items-start gap-3 bg-white/[0.01] border border-white/5 p-3.5 rounded-2xl">
          <div className="p-1.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] mt-0.5 border border-[#D4AF37]/20 shrink-0">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-white/90 uppercase tracking-widest">Elite Distribution Model</h4>
            <p className="text-[10px] text-white/45 leading-relaxed mt-1 font-medium">
              Get $0.10 starting bonus upon registration (boosted to $0.30 if invited via a referral link). Earn $0.50 premium commissions for every successful referral.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-white/[0.01] border border-white/5 p-3.5 rounded-2xl">
          <div className="p-1.5 rounded bg-[#10B981]/10 text-[#10B981] mt-0.5 border border-[#10B981]/20 shrink-0">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-white/90 uppercase tracking-widest">Firebase Account Authentication</h4>
            <p className="text-[10px] text-white/45 leading-relaxed mt-1 font-medium">
              Securely register using custom ID tokens. Fully validated real-time database state replication with high-performance SSL encryption.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

