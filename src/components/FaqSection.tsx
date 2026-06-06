import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItemConfig {
  question: string;
  answer: string | React.ReactNode;
}

const faqs: FaqItemConfig[] = [
  {
    question: 'How do deposit cycles and earnings work?',
    answer: (
      <div className="space-y-2">
        <p>Your daily profit of approved deposits is distributed every 24 hours based on the tier levels:</p>
        <ol className="space-y-1 list-decimal list-inside text-white/50 pl-1">
          <li><strong className="text-amber-500">Level 1: Bronze ($5 - $14)</strong> - earns <span className="text-emerald-400 font-semibold">3% daily</span></li>
          <li><strong className="text-indigo-400">Level 2: Silver ($15 - $49)</strong> - earns <span className="text-emerald-400 font-semibold">4% daily</span></li>
          <li><strong className="text-yellow-400">Level 3: Gold ($50 - $99)</strong> - earns <span className="text-emerald-400 font-semibold">5% daily</span></li>
          <li><strong className="text-emerald-400">Level 4: Platinum Star ($100+)</strong> - earns <span className="text-emerald-400 font-semibold">7% daily</span></li>
        </ol>
        <p className="text-[11px] text-white/40 italic">Note: The cycle restarts every 24 hours from the time your deposit is validated.</p>
      </div>
    )
  },
  {
    question: 'How do referral earnings work?',
    answer: 'When a new user signs up using your unique referral link and makes their first deposit, you will automatically receive a referral bonus credited to your account balance. Distribute your link to maximize your earnings.'
  },
  {
    question: 'What are the withdrawal status timelines?',
    answer: (
      <span>
        Withdrawal requests are initially marked as &quot;Pending&quot;. We prioritize <strong>Fast Withdrawals</strong>, meaning they are reviewed and processed by our active ledger checkers at high speeds. Once verified, funds dispatch instantly to your designated wallet address.
      </span>
    )
  },
  {
    question: 'How do I contact customer support 24/7?',
    answer: (
      <span>
        We offer elite 24/7 customer support. For transactions, deposit confirmations, or withdrawal inquiries, contact our live Telegram representative at{' '}
        <a 
          href="https://t.me/MoneyMindSpaceSupport" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-sky-400 hover:underline font-bold"
        >
          @MoneyMindSpaceSupport
        </a>
        . For any general admin questions or queries, you can reach out directly to{' '}
        <a 
          href="https://t.me/Alexadminhub" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#D4AF37] hover:underline font-bold"
        >
          @Alexadminhub
        </a>
        .
      </span>
    )
  }
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-[#D4AF37]/15 p-2 rounded-lg border border-[#D4AF37]/20">
          <HelpCircle className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Frequently Asked Questions</h2>
          <p className="text-[11px] text-white/50 tracking-wide mt-0.5">Learn more about cycles, referrals, and withdrawals.</p>
        </div>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div 
              key={index} 
              className={`border border-white/5 bg-[#121212] overflow-hidden transition-all duration-300 ${isOpen ? 'rounded-2xl border-white/10' : 'rounded-xl hover:border-white/10'}`}
            >
              <button 
                onClick={() => toggleOpen(index)}
                className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none cursor-pointer"
              >
                <span className="text-[13px] font-semibold text-white/90">{faq.question}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white/5 p-1 rounded-full text-white/50"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-5 pb-5 text-[12px] text-white/60 leading-relaxed max-w-2xl border-t border-white/5 pt-3">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
