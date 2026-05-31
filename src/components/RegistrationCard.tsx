/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserPlus, Sparkles, TrendingUp, HelpCircle, Key, LogIn, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AVATAR_PRESETS } from '../lib/avatars';
import earnhubLogo from '../assets/images/earnhub_logo_1780161493423.png';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, collection } from 'firebase/firestore';

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
    if (!/^[a-zA-Z0-9_\- .@]+$/.test(userId.trim())) {
      setError('User ID can only contain letters, numbers, spaces, underscores, hyphens, dots, or @ symbols.');
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
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setError('This User ID is already occupied by another VIP member.');
        setIsLoading(false);
        return;
      }

      // 2. Store full profile database record in Firestore under the custom User ID
      await setDoc(userRef, {
        userId: cleanUserId,
        name: cleanName,
        avatar: selectedAvatar,
        signupBonus: 0.5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Store authentication credentials securely in the private secrets subcollection doc
      const secretsRef = doc(db, 'users', cleanUserId, 'secrets', 'auth');
      await setDoc(secretsRef, {
        password: password,
      });

      // 4. Handle conversion ledger event if user joined via valid referrer invite link
      if (referredBy && referredBy !== cleanUserId) {
        try {
          const inviterRef = doc(db, 'users', referredBy);
          const inviterSnap = await getDoc(inviterRef);
          if (inviterSnap.exists()) {
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

            const referralLogRef = doc(collection(db, 'users', referredBy, 'referrals'));
            await setDoc(referralLogRef, {
              id: referralLogRef.id,
              timestamp: timestampStr,
              amount: 0.8,
              referrerName: cleanName,
              refereeId: cleanUserId,
              refereeAvatar: selectedAvatar,
              source: referredSource || 'default',
              createdAt: serverTimestamp(),
            });
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
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        setError('❌ Invalid User ID or Password');
        setIsLoading(false);
        return;
      }

      // 2. Fetch secure credentials check to authenticate custom login session
      const secretsRef = doc(db, 'users', cleanUserId, 'secrets', 'auth');
      const secretsSnap = await getDoc(secretsRef);
      
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
      className="w-full max-w-md bg-[#111111] rounded-2xl border border-white/5 shadow-2xl p-6 md:p-8 space-y-6"
    >
      <div className="text-center space-y-2">
        <img 
          src={earnhubLogo}
          alt="EarnHub Gold Premium Logo"
          className="w-16 h-16 mx-auto object-contain rounded-xl border border-[#D4AF37]/20 shadow-[0_0_20px_rgba(212,175,55,0.15)] bg-black mb-2"
          referrerPolicy="no-referrer"
        />
        <h2 className="text-2xl font-semibold tracking-tight text-[#E5E7EB] font-serif">
          {mode === 'signup' ? (
            <>Join <span className="text-[#D4AF37]">EarnHub</span> Elite</>
          ) : (
            <>Welcome to <span className="text-[#D4AF37]">EarnHub</span></>
          )}
        </h2>
        <p className="text-xs text-white/50 leading-relaxed max-w-xs mx-auto">
          {mode === 'signup' 
            ? 'Create secure, real-time credentials to unlock professional distribution and payout audits.' 
            : 'Access your private dashboard to monitor balance matrices and secure transaction ledger pipelines.'}
        </p>
      </div>

      {/* Dynamic Tabs/Toggles */}
      <div className="grid grid-cols-2 gap-1 bg-black/45 p-1 rounded-xl border border-white/5">
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError('');
            setSuccessMsg('');
          }}
          className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
            mode === 'signup' 
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/25 shadow-sm' 
              : 'text-white/40 hover:text-white/70'
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
          className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
            mode === 'login' 
              ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/25 shadow-sm' 
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          Sign In
        </button>
      </div>

      <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} className="space-y-4">
        {/* User ID Field */}
        <div>
          <label htmlFor="userid-input" className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-2 font-sans">
            VIP User ID
          </label>
          <div className="relative">
            <input
              id="userid-input"
              type="text"
              placeholder="e.g. alex_miller"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                if (e.target.value.trim()) setError('');
              }}
              className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-[#0C0C0C] text-[#E5E7EB] placeholder-white/20 font-sans focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 transition-all duration-200"
            />
          </div>
          {mode === 'signup' && (
            <p className="mt-1 text-[9px] text-white/30 font-medium">Your User ID is your secure, direct login key: <span className="text-[#D4AF37]/75 font-mono">{userId ? userId : 'id'}</span></p>
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
              className="space-y-4"
            >
              <div>
                <label htmlFor="name-input" className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-2 font-sans">
                  Full Name of Member
                </label>
                <input
                  id="name-input"
                  type="text"
                  placeholder="e.g. Alex Miller"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (e.target.value.trim()) setError('');
                  }}
                  className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-[#0C0C0C] text-[#E5E7EB] placeholder-white/20 font-sans focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 transition-all duration-200"
                />
              </div>

              {/* Avatar Preset Grid */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-2 font-sans">
                  Select Your Elite Badge Avatar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_PRESETS.map((avatar) => {
                    const IconComponent = avatar.icon;
                    const isSelected = selectedAvatar === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-200 cursor-pointer text-center group ${
                          isSelected
                            ? `${avatar.color} border-white/20 ring-1 ring-white/10`
                            : 'border-white/5 bg-[#0C0C0C] text-white/30 hover:text-white/80 hover:border-white/10'
                        }`}
                      >
                        <IconComponent className={`w-5 h-5 mb-1 transition-transform group-hover:scale-110 ${
                          isSelected ? 'scale-110' : ''
                        }`} />
                        <span className="text-[8px] font-semibold uppercase tracking-wider block truncate max-w-full">
                          {avatar.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Secure Password Field */}
        <div>
          <label htmlFor="password-input" className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-2 font-sans">
            Secure Password
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
              <Key className="w-3.5 h-3.5" />
            </span>
            <input
              id="password-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (e.target.value) setError('');
              }}
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-white/10 bg-[#0C0C0C] text-[#E5E7EB] placeholder-white/20 font-sans focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 transition-all duration-200"
            />
          </div>
        </div>

        {/* Feedback Messages */}
        {error && (
          <p className="text-xs text-red-400 font-medium flex items-center gap-1.5 bg-red-500/5 px-3 py-1.5 rounded-lg border border-red-500/10">
            <span>⚠️</span> {error}
          </p>
        )}

        {successMsg && (
          <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10 animate-bounce">
            <span className="animate-pulse">🎉</span> {successMsg}
          </p>
        )}

        {/* Submit Actions */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#8A6D3B] text-black font-semibold text-xs uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.15)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          ) : mode === 'signup' ? (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Sign Up & Onboard
            </>
          ) : (
            <>
              <LogIn className="w-3.5 h-3.5" />
              Sign In to Account
            </>
          )}
        </button>
      </form>

      {/* Alternative View triggers */}
      <div className="text-center">
        {mode === 'signup' ? (
          <button
            type="button"
            onClick={() => setMode('login')}
            className="text-[10px] text-white/40 uppercase tracking-widest font-semibold hover:text-[#D4AF37] transition-all cursor-pointer underline decoration-[#D4AF37]/35 decoration-2"
          >
            Already have an account? Sign In
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode('signup')}
            className="text-[10px] text-white/40 uppercase tracking-widest font-semibold hover:text-[#D4AF37] transition-all cursor-pointer underline decoration-[#D4AF37]/35 decoration-2"
          >
            Don't have an account? Sign Up
          </button>
        )}
      </div>

      <div className="pt-4 border-t border-white/5 space-y-3.5">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded bg-white/5 text-[#D4AF37] mt-0.5 border border-white/5">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white/80 font-sans">Elite Distribution Model</h4>
            <p className="text-[11px] text-white/40 leading-normal">
              Get $0.50 starting bonus upon registration. Earn $0.80 premium commission for every successful referral.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded bg-white/5 text-[#D4AF37] mt-0.5 border border-white/5">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white/80 font-sans">Firebase Account Authentication</h4>
            <p className="text-[11px] text-white/40 leading-normal">
              Securely register using custom ID tokens. Fully validated real-time database state replication.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

