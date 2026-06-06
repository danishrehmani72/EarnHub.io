/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserPlus, Sparkles, TrendingUp, HelpCircle, Key, LogIn, UserCheck, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import earnhubLogo from '../assets/images/earnhub_logo_1780161493423.png';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, collection, getDocFromServer, query, where, getDocs } from 'firebase/firestore';

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
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot'>('signup');
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('crown');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Recovery/PIN State attributes
  const [recoveryCode, setRecoveryCode] = useState('');
  const [forgotSubTab, setForgotSubTab] = useState<'userId' | 'password' | 'manual'>('userId');
  const [recoveryFoundId, setRecoveryFoundId] = useState<string | null>(null);
  
  // Custom states for 4-Digit Security PIN & Reset Modal
  const [confirmPin, setConfirmPin] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

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
    if (!recoveryCode.trim()) {
      setError('Please create your 4-Digit Security PIN.');
      return;
    }
    if (recoveryCode.trim().length !== 4) {
      setError('Security PIN must be exactly a 4-Digit code.');
      return;
    }
    if (recoveryCode.trim() !== confirmPin.trim()) {
      setError('Confirm PIN does not match your 4-Digit Security PIN.');
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
        user_id: cleanUserId, // lowercase DB key
        name: cleanName,
        full_name: cleanName, // lowercase DB key
        avatar: selectedAvatar,
        signupBonus: signupBonusAmount,
        referredBy: isReferralValid ? referredBy : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        password: password, // lowercase DB key
        security_pin: recoveryCode.trim(), // lowercase DB key
      });

      // 3. Store authentication credentials securely in the private secrets subcollection doc
      const secretsRef = doc(db, 'users', cleanUserId, 'secrets', 'auth');
      await setDoc(secretsRef, {
        password: password,
        recoveryCode: recoveryCode.trim(),
        security_pin: recoveryCode.trim(),
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

  // Process Forgot/Recovery Form submission
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setRecoveryFoundId(null);

    // Dynamic recovery execution
    if (forgotSubTab === 'userId') {
      if (!name.trim()) {
        setError('Please enter your Full Name.');
        return;
      }
      if (!recoveryCode.trim()) {
        setError('Please enter your 4-6 digit Recovery PIN/Code.');
        return;
      }

      setIsLoading(true);
      try {
        const cleanName = name.trim();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('name', '==', cleanName));
        const qSnap = await getDocs(q);

        if (qSnap.empty) {
          setError('❌ No account registered under this exact Full Name.');
          setIsLoading(false);
          return;
        }

        let foundUid: string | null = null;
        for (const docSnap of qSnap.docs) {
          const uid = docSnap.id;
          const secretRef = doc(db, 'users', uid, 'secrets', 'auth');
          const secretSnap = await getDocWithRetry(secretRef);
          if (secretSnap.exists()) {
            const dataSec = secretSnap.data();
            if (dataSec.recoveryCode === recoveryCode.trim()) {
              foundUid = uid;
              break;
            }
          }
        }

        if (foundUid) {
          setSuccessMsg('🎉 Account ID verified!');
          setRecoveryFoundId(foundUid);
          setUserId(foundUid); // Prefill Sign In input with the discovered user ID
        } else {
          setError('❌ Invalid Recovery PIN/Code for this member name.');
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'System error searching membership registry.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Reset Password
      if (!userId.trim()) {
        setError('Please enter your VIP User ID.');
        return;
      }
      if (!recoveryCode.trim()) {
        setError('Please enter your Recovery PIN/Code.');
        return;
      }
      if (password.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }

      setIsLoading(true);
      const cleanUserId = userId.trim().toLowerCase();

      try {
        const userRef = doc(db, 'users', cleanUserId);
        const userSnap = await getDocWithRetry(userRef);
        if (!userSnap.exists()) {
          setError('❌ This VIP User ID does not exist in our system.');
          setIsLoading(false);
          return;
        }

        const secretRef = doc(db, 'users', cleanUserId, 'secrets', 'auth');
        const secretSnap = await getDocWithRetry(secretRef);
        if (!secretSnap.exists() || secretSnap.data().recoveryCode !== recoveryCode.trim()) {
          setError('❌ Verification failed. Invalid Recovery PIN/Code.');
          setIsLoading(false);
          return;
        }

        // Recovery matches, update password!
        await setDoc(secretRef, {
          password: password,
          recoveryCode: recoveryCode.trim() // preserve existing pin
        });

        setSuccessMsg('✅ Password Reset Successfully!');
        setTimeout(() => {
          setMode('login');
          setSuccessMsg('');
          setPassword('');
          setError('');
        }, 1500);

      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Could not update credential keys.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Dedicated handshaker for Reset Password of forget popup modal
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    const cleanUid = resetUserId.trim().toLowerCase();
    const pin = resetPin.trim();
    const newPass = resetNewPassword;
    const confirmPass = resetConfirmPassword;

    if (!cleanUid) {
      setResetError('Please enter your User ID.');
      return;
    }
    if (!pin) {
      setResetError('Please enter your 4-Digit Security PIN.');
      return;
    }
    if (pin.length !== 4) {
      setResetError('Security PIN must be exactly a 4-Digit code.');
      return;
    }
    if (!newPass) {
      setResetError('Please enter your new password.');
      return;
    }
    if (newPass.length < 6) {
      setResetError('New Password must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setResetError('Confirm Password does not match your new password.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verify existence in db
      const userRef = doc(db, 'users', cleanUid);
      const userSnap = await getDocWithRetry(userRef);
      if (!userSnap.exists()) {
        setResetError('❌ This User ID does not exist in our system.');
        setIsLoading(false);
        return;
      }

      // Check current pin. First check main user document 'security_pin' or fallback to secrets 'recoveryCode'
      const userData = userSnap.data();
      let storedPin = userData.security_pin || null;

      const secretRef = doc(db, 'users', cleanUid, 'secrets', 'auth');
      const secretSnap = await getDocWithRetry(secretRef);
      if (secretSnap.exists() && !storedPin) {
        storedPin = secretSnap.data().recoveryCode || secretSnap.data().security_pin || null;
      }

      if (!storedPin || storedPin !== pin) {
        setResetError('❌ Verification failed. Invalid Security PIN.');
        setIsLoading(false);
        return;
      }

      // Pin matched! Let's update password and security_pin in both places for high availability
      await setDoc(userRef, {
        ...userData,
         password: newPass,
         security_pin: pin,
         updatedAt: serverTimestamp(),
      });

      await setDoc(secretRef, {
        password: newPass,
        recoveryCode: pin,
        security_pin: pin,
      });

      setResetSuccess('✅ Password Reset Successfully!');
      setTimeout(() => {
        setIsResetModalOpen(false);
        // Clear reset states
        setResetUserId('');
        setResetPin('');
        setResetNewPassword('');
        setResetConfirmPassword('');
        setResetError('');
        setResetSuccess('');
        // Switch main screen to login
        setMode('login');
        setUserId(cleanUid);
        setPassword('');
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setResetError(err.message || 'Could not update security keys.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0B0B0B] via-[#050505] to-black border-2 border-[#D4AF37]/45 hover:border-[#10B981]/60 shadow-[0_0_40px_rgba(212,175,55,0.12)] hover:shadow-[0_0_55px_rgba(16,185,129,0.18)] transition-all duration-500 p-6 md:p-8 space-y-7 max-w-md w-full backdrop-blur-xl animate-fade-in"
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
          ) : mode === 'login' ? (
            <>Welcome to <span className="text-[#D4AF37] animate-pulse">MoneyMind Space</span></>
          ) : (
            <>Account <span className="text-[#D4AF37] animate-pulse">VIP Recovery</span></>
          )}
        </h2>
        <p className="text-[11px] text-white/50 leading-relaxed font-sans max-w-xs mx-auto">
          {mode === 'signup' 
            ? 'Create secure, real-time credentials to unlock professional distribution and payout audits.' 
            : mode === 'forgot'
              ? 'Enter your registered credentials and Security PIN to safely discover your User ID or reset your key.'
              : 'Access your private dashboard to monitor balance matrices and secure transaction ledger pipelines.'}
        </p>
      </div>

      {/* Dynamic Tabs/Toggles with custom state styling */}
      {mode !== 'forgot' ? (
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
      ) : (
        <div className="grid grid-cols-3 gap-1 bg-black/80 p-1.5 rounded-2xl border border-[#D4AF37]/35 shadow-inner shadow-black relative z-10">
          <button
            type="button"
            onClick={() => {
              setForgotSubTab('userId');
              setError('');
              setSuccessMsg('');
              setRecoveryFoundId(null);
            }}
            className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              forgotSubTab === 'userId' 
                ? 'bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)] font-black' 
                : 'text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
            }`}
          >
            Find ID
          </button>
          <button
            type="button"
            onClick={() => {
              setForgotSubTab('password');
              setError('');
              setSuccessMsg('');
              setRecoveryFoundId(null);
            }}
            className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              forgotSubTab === 'password' 
                ? 'bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)] font-black' 
                : 'text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
            }`}
          >
            Reset PW
          </button>
          <button
            type="button"
            onClick={() => {
              setForgotSubTab('manual');
              setError('');
              setSuccessMsg('');
              setRecoveryFoundId(null);
            }}
            className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              forgotSubTab === 'manual' 
                ? 'bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)] font-black' 
                : 'text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
            }`}
          >
            No PIN?
          </button>
        </div>
      )}

      <form onSubmit={mode === 'signup' ? handleSignup : mode === 'login' ? handleLogin : handleForgotSubmit} className="space-y-4 relative z-10 text-left animate-fade-in">
        {/* User ID Field */}
        {(mode === 'signup' || mode === 'login' || (mode === 'forgot' && forgotSubTab === 'password')) && (
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
                placeholder={mode === 'forgot' ? "Enter your unique ID" : "e.g. Alexmiller123"}
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
        )}

        {/* Full Name Field (Signup or recovering User ID) */}
        <AnimatePresence mode="popLayout">
          {(mode === 'signup' || (mode === 'forgot' && forgotSubTab === 'userId')) && (
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
        {(mode === 'signup' || mode === 'login' || (mode === 'forgot' && forgotSubTab === 'password')) && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">🔑</span>
              <label htmlFor="password-input" className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                {mode === 'forgot' ? 'New Secure Password' : 'Secure Password'}
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
        )}

        {/* Security PIN / Recovery Code (Signup & Forgot PIN checks) */}
        <AnimatePresence mode="popLayout">
          {(mode === 'signup' || (mode === 'forgot' && forgotSubTab !== 'manual')) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🔐</span>
                  <label htmlFor="recovery-pin-input" className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                    {mode === 'signup' ? '4-Digit Security PIN' : 'Recovery PIN / Code'}
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="recovery-pin-input"
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 5831"
                    value={recoveryCode}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      setRecoveryCode(cleaned);
                      if (cleaned) setError('');
                    }}
                    className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 pr-20 text-xs text-white placeholder-white/25 select-all outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black font-mono tracking-widest text-center"
                  />
                  {mode === 'signup' && (
                    <button
                      type="button"
                      onClick={() => {
                        const r = Math.floor(1000 + Math.random() * 9000).toString();
                        setRecoveryCode(r);
                        setError('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-extrabold text-[#D4AF37] uppercase tracking-wider bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/35 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      🎲 Auto
                    </button>
                  )}
                </div>
              </div>

              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🔒</span>
                    <label htmlFor="confirm-pin-input" className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                      Confirm PIN
                    </label>
                  </div>
                  <input
                    id="confirm-pin-input"
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 5831"
                    value={confirmPin}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      setConfirmPin(cleaned);
                      if (cleaned) setError('');
                    }}
                    className="w-full bg-black/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all rounded-xl shadow-inner shadow-black font-mono tracking-widest text-center"
                  />

                  {/* Gorgeous golden English informational warning note */}
                  <div className="mt-2.5 p-3.5 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl text-left animate-fade-in">
                    <p className="text-[10.5px] text-amber-400 font-bold flex items-center gap-1.5">
                      <span className="text-sm select-none">⚠️</span>
                      <span>Remember your 4-Digit Security PIN.</span>
                    </p>
                    <p className="text-[10px] text-white/60 leading-relaxed font-sans mt-0.5">
                      In case you forget your password, this PIN will be used.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Recovery Help Block */}
        {mode === 'forgot' && forgotSubTab === 'manual' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-b from-zinc-900 via-black to-[#0A0A0A] rounded-2xl border border-[#D4AF37]/30 text-left space-y-4 relative z-20"
          >
            <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-sm select-none">💬</span>
              <h4 className="text-[10px] font-black uppercase text-white tracking-widest">
                Manual Reset Directory
              </h4>
            </div>
            
            <p className="text-[10.5px] text-white/70 leading-relaxed font-sans">
              Did you register before the PIN update, or forgot your Recovery PIN/Code? Our supervisor <strong className="text-[#D4AF37]">@Alexadminhub</strong> of <span className="text-[#D4AF37] font-semibold">Moneymindspace.online</span> will manually confirm your profile data and reset your security key!
            </p>

            <div className="space-y-2 text-[10px] bg-black/40 p-3 rounded-xl border border-white/5 font-mono">
              <p className="text-white/40 uppercase text-[8.5px] font-black tracking-widest">📋 Provide to Admin:</p>
              <div className="flex gap-2 text-white/70">
                <span className="text-[#D4AF37] font-bold">1.</span>
                <span>The exact **Full Name** of the member profile</span>
              </div>
              <div className="flex gap-2 text-white/70">
                <span className="text-[#D4AF37] font-bold">2.</span>
                <span>The approximate **Account Balance** matrix</span>
              </div>
              <div className="flex gap-2 text-white/70">
                <span className="text-[#D4AF37] font-bold">3.</span>
                <span>Screenshot of deposit confirmation/staking hash</span>
              </div>
            </div>

            <div className="pt-1 select-none">
              <a
                href="https://t.me/Alexadminhub"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] text-black font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all text-center shadow-[0_0_15px_rgba(212,175,55,0.25)] cursor-pointer"
              >
                <span>Message live helper now</span>
                <span className="bg-black/10 px-1.5 py-0.5 rounded text-[8.5px] text-black/85">@Alexadminhub</span>
              </a>
            </div>
          </motion.div>
        )}

        {/* Feedback Messages */}
        {error && (
          <p className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
            <span>⚠️ Error:</span>
            <span>{error}</span>
          </p>
        )}

        {successMsg && (
          <p className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all animate-bounce">
            <span>✅ Success:</span>
            <span>{successMsg}</span>
          </p>
        )}

        {/* Retrieve ID Result Panel */}
        {mode === 'forgot' && recoveryFoundId && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-4 bg-gradient-to-r from-[#D4AF37]/15 to-[#10B981]/15 rounded-2xl border-2 border-[#D4AF37]/50 text-center space-y-2 select-all relative z-20"
          >
            <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-black">VIP Account Located</p>
            <div className="text-xs font-black text-white font-mono flex items-center justify-center gap-1.5 bg-black/85 py-2.5 px-3 rounded-xl border border-white/10 select-all">
              🔑 User ID: <span className="text-emerald-400 text-base font-bold select-all">{recoveryFoundId}</span>
            </div>
            <p className="text-[9px] text-white/50 font-medium">Use this User ID and your VIP password to sign in directly.</p>
          </motion.div>
        )}

        {/* Submit Actions */}
        {(mode !== 'forgot' || forgotSubTab !== 'manual') && (
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
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>🔑 Sign In directly</span>
              </>
            ) : forgotSubTab === 'userId' ? (
              <>
                <UserCheck className="w-4 h-4" />
                <span>🔍 Find VIP User ID</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>🔒 Reset Password</span>
              </>
            )}
          </button>
        )}

        {mode === 'login' && (
          <div className="text-center pt-2 select-none animate-fade-in">
            <button
              type="button"
              onClick={() => {
                setIsResetModalOpen(true);
                setResetUserId('');
                setResetPin('');
                setResetNewPassword('');
                setResetConfirmPassword('');
                setResetError('');
                setResetSuccess('');
              }}
              className="text-[11px] text-[#24A1DE] hover:text-[#24A1DE]/80 font-black uppercase tracking-wider transition-all cursor-pointer hover:underline"
            >
              Forgot Password?
            </button>
          </div>
        )}
      </form>

      {/* Alternative View triggers */}
      <div className="text-center relative z-10">
        {mode === 'signup' ? (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccessMsg('');
            }}
            className="text-[9.5px] text-white/50 uppercase tracking-widest font-black hover:text-[#D4AF37] transition-all cursor-pointer underline decoration-[#D4AF37]/35 decoration-2"
          >
            Already have an account? Sign In
          </button>
        ) : mode === 'login' ? (
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError('');
              setSuccessMsg('');
            }}
            className="text-[9.5px] text-white/50 uppercase tracking-widest font-black hover:text-[#D4AF37] transition-all cursor-pointer underline decoration-[#D4AF37]/35 decoration-2"
          >
            Don't have an account? Sign Up
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccessMsg('');
              setRecoveryFoundId(null);
            }}
            className="inline-flex items-center gap-1.5 text-[9.5px] text-zinc-400 uppercase tracking-widest font-black hover:text-white transition-all cursor-pointer hover:underline"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
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
        <div className="flex items-start gap-3 bg-[#24A1DE]/5 border border-[#24A1DE]/20 p-3.5 rounded-2xl hover:border-[#24A1DE]/40 transition-[border-color] duration-300">
          <div className="p-1.5 rounded bg-[#24A1DE]/10 text-[#24A1DE] mt-0.5 border border-[#24A1DE]/25 shrink-0">
            <span className="text-[11px] leading-none select-none">📢</span>
          </div>
          <div>
            <h4 className="text-[10px] font-black text-white/90 uppercase tracking-widest flex items-center justify-between gap-2 flex-wrap">
              <span>Official Telegram Community</span>
              <span className="text-[7.5px] bg-[#24A1DE]/15 text-[#24A1DE] font-bold px-1.5 py-0.5 rounded border border-[#24A1DE]/30 uppercase tracking-wider">Join Group</span>
            </h4>
            <p className="text-[10px] text-white/45 leading-relaxed mt-1 font-medium">
              Join our public channel at <a href="https://t.me/moneymindonlineearningspace" target="_blank" rel="noopener noreferrer" className="text-[#24A1DE] font-extrabold hover:underline">t.me/moneymindonlineearningspace</a> representing <span className="text-[#D4AF37] font-semibold">Moneymindspace.online</span> today! Exchange payment receipts and claim staking updates.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 p-3.5 rounded-2xl hover:border-[#D4AF37]/45 transition-[border-color] duration-300">
          <div className="p-1.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] mt-0.5 border border-[#D4AF37]/25 shrink-0">
            <span className="text-[11px] leading-none select-none">💬</span>
          </div>
          <div>
            <h4 className="text-[10px] font-black text-white/90 uppercase tracking-widest flex items-center justify-between gap-2 flex-wrap">
              <span>Direct Support Helpline</span>
              <span className="text-[7.5px] bg-[#D4AF37]/15 text-[#D4AF37] font-bold px-1.5 py-0.5 rounded border border-[#D4AF37]/35 uppercase tracking-wider">Message Admin</span>
            </h4>
            <p className="text-[10px] text-white/45 leading-relaxed mt-1 font-medium">
              Have persistent queries, premium activation issues, or login failures? Chat directly with our supervisor on Telegram at <a href="https://t.me/Alexadminhub" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] font-extrabold hover:underline">@Alexadminhub</a>.
            </p>
          </div>
        </div>
      </div>
    </motion.div>

    {/* Reset Password Modal Overlay */}
    <AnimatePresence>
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.99 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-sm bg-gradient-to-b from-[#0F0F0E] to-[#040404] border-2 border-[#D4AF37] rounded-3xl p-6 shadow-[0_0_50px_rgba(212,175,55,0.25)] text-left space-y-5"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-all cursor-pointer font-bold text-sm bg-white/5 hover:bg-white/10 p-1.5 rounded-lg border border-white/5"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[#D4AF37] text-[8.5px] uppercase font-black tracking-widest">
                VIP Support Panel
              </span>
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Reset Password
              </h3>
              <p className="text-[10px] text-white/55">
                Confirm your registered identity details to safely establish a new secure entry key.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* User ID */}
              <div className="space-y-1.5">
                <label className="block text-[8.5px] font-black text-white/70 uppercase tracking-widest">
                  User ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your VIP User ID"
                  value={resetUserId}
                  onChange={(e) => setResetUserId(e.target.value.replace(/\s+/g, '').toLowerCase())}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 select-all outline-none focus:border-[#D4AF37]/60"
                />
              </div>

              {/* 4-Digit PIN */}
              <div className="space-y-1.5">
                <label className="block text-[8.5px] font-black text-white/70 uppercase tracking-widest">
                  4-Digit Security PIN
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  placeholder="Enter 4-Digit PIN"
                  value={resetPin}
                  onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 select-all outline-none focus:border-[#D4AF37]/60 font-mono tracking-widest text-center"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="block text-[8.5px] font-black text-white/70 uppercase tracking-widest">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Create security password (min 6 chars)"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 outline-none focus:border-[#D4AF37]/60"
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="block text-[8.5px] font-black text-white/70 uppercase tracking-widest">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new secure password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 outline-none focus:border-[#D4AF37]/60"
                />
              </div>

              {/* Notifications */}
              {resetError && (
                <p className="text-[9.5px] font-bold text-rose-500 leading-normal bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg font-mono">
                  ⚠️ Error: {resetError}
                </p>
              )}
              {resetSuccess && (
                <p className="text-[10px] font-black text-[#10B981] leading-normal bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg font-mono">
                  ✅ Success: {resetSuccess}
                </p>
              )}

              {/* Submit Reset */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] text-black font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all duration-300 text-center shadow-lg shadow-[#D4AF37]/10 cursor-pointer disabled:opacity-40"
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
);
}

