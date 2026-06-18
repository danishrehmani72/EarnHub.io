import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, CheckCircle, AlertTriangle, X, Loader2, RefreshCw } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  userId: string;
  onVerified: () => void;
}

export default function EmailVerificationModal({
  isOpen,
  onClose,
  email,
  userId,
  onVerified
}: EmailVerificationModalProps) {
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [demoState, setDemoState] = useState<{ isDemo: boolean; code?: string } | null>(null);

  // Send the verification code
  const sendVerificationCode = async () => {
    if (!email) return;
    setIsSending(true);
    setError('');
    setDemoState(null);

    // Generate a 6-digit random code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(otp);

    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: otp })
      });

      const data = await response.json();
      if (data.success) {
        setResendCooldown(30); // 30s cooldown
        if (data.mode === 'demo' && data.code) {
          setDemoState({ isDemo: true, code: data.code });
        }
      } else {
        setError(data.error || 'Failed to dispatch verification email.');
      }
    } catch (err: any) {
      console.error('[EmailVerificationModal] send error:', err);
      // Fallback code visual helper if API fails
      setGeneratedCode(otp);
      setDemoState({ isDemo: true, code: otp });
    } finally {
      setIsSending(false);
    }
  };

  // Cooldown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Trigger send code on mount when open
  useEffect(() => {
    if (isOpen && email && !generatedCode && !success) {
      sendVerificationCode();
    }
  }, [isOpen, email]);

  // Handle Verify Submission
  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      // Comparison logic: Check input against generated code
      if (code.trim() === generatedCode || (demoState?.code && code.trim() === demoState.code)) {
        // Update user profile in Firestore db to mark emailVerified as true
        const userRef = doc(db, 'users', userId.trim().toLowerCase());
        await updateDoc(userRef, {
          emailVerified: true,
          updatedAt: serverTimestamp()
        });

        setSuccess(true);
        setTimeout(() => {
          onVerified();
          onClose();
        }, 1800);
      } else {
        setError('The 6-digit code you entered is incorrect. Please check your spam folder or request a new code.');
      }
    } catch (err: any) {
      console.error('[EmailVerificationModal] DB write error:', err);
      setError(err.message || 'An error occurred while verifying your account.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/90 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative bg-[#111111] border border-white/10 p-6 sm:p-8 rounded-3xl text-center shadow-[0_20px_50px_rgba(212,175,55,0.15)] max-w-md w-full overflow-hidden"
        >
          {/* Top Gold Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

          {/* Close button */}
          {!success && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {success ? (
            <div className="py-8 space-y-4">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1.1, 1], opacity: 1 }}
                className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400"
              >
                <CheckCircle className="w-10 h-10 animate-pulse" />
              </motion.div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white uppercase tracking-wider font-sans">
                  Account Verified
                </h3>
                <p className="text-xs text-white/60">
                  Congratulations! Your email address has been successfully verified. Entering secure workspace...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Icon */}
              <div className="w-16 h-16 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto text-[#D4AF37]">
                {isSending ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Mail className="w-7 h-7" />
                )}
              </div>

              {/* Title & Descr */}
              <div className="space-y-2">
                <h3 className="text-lg font-black uppercase tracking-widest text-[#D4AF37] font-sans">
                  Verify Your Email
                </h3>
                <p className="text-xs text-white/60 leading-relaxed px-2">
                  A 6-digit confirmation code was sent to <span className="text-white font-semibold underline decoration-[#D4AF37]/50">{email}</span>. Please fetch it to verify your account.
                </p>
              </div>

              {/* Secure verification input form */}
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="E N T E R  6 - D I G I T  C O D E"
                    value={code}
                    disabled={isVerifying}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCode(val);
                      if (val) setError('');
                    }}
                    className="w-full text-center bg-black border border-white/10 rounded-2xl py-4 font-mono text-lg tracking-[0.25em] text-[#D4AF37] focus:border-[#D4AF37]/60 outline-none transition-all shadow-inner"
                  />
                </div>

                {/* Resend utility link */}
                <div className="flex items-center justify-center gap-2 text-[10px]">
                  <span className="text-white/40">Didn't receive code?</span>
                  <button
                    type="button"
                    disabled={isSending || resendCooldown > 0}
                    onClick={sendVerificationCode}
                    className="text-[#D4AF37] hover:underline flex items-center gap-1 font-bold uppercase transition-all disabled:text-white/20 disabled:no-underline cursor-pointer"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Dispatched...
                      </>
                    ) : resendCooldown > 0 ? (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        Resend Code ({resendCooldown}s)
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-2.5 h-2.5" />
                        Resend Code
                      </>
                    )}
                  </button>
                </div>

                {/* Error feedback */}
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10.5px] leading-relaxed flex items-start gap-2 text-left">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Sandbox Bypass helper */}
                {demoState?.isDemo && (
                  <div className="p-3.5 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl text-left space-y-1 animate-fade-in select-all">
                    <p className="text-[9.5px] font-black tracking-widest uppercase text-[#D4AF37] flex items-center gap-1">
                      <span>⚡</span> Sandbox Demo Fallback Mode
                    </p>
                    <p className="text-[9px] text-white/50 leading-relaxed">
                      Resend delivery is offline or API key is unconfigured. Copy verification code below to login:
                    </p>
                    <div className="bg-black border border-white/5 p-2 rounded text-center text-sm font-mono tracking-widest text-[#D4AF37] font-bold">
                      {demoState.code}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isVerifying || code.length !== 6}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#f3cb49] to-[#D4AF37] text-black font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all text-center shadow-[0_4px_15px_rgba(212,175,55,0.2)] disabled:from-white/5 disabled:to-white/5 disabled:text-white/25 disabled:shadow-none cursor-pointer"
                >
                  {isVerifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      VERIFYING ACCOUNT...
                    </span>
                  ) : (
                    'CONFIRM VERIFICATION CODE'
                  )}
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
