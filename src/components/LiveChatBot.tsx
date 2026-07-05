import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, X, Send, Sparkles, Bot, ArrowRight, CornerDownLeft } from "lucide-react";
import { playSound } from "../lib/sounds";

const getClientFallbackReply = (msg: string): string => {
  const norm = msg.toLowerCase().trim();
  
  if (norm.includes("withdraw") || norm.includes("nikal") || norm.includes("payout") || norm.includes("review")) {
    return `**Withdrawal Review Info:** 💰

1. **How to Withdraw**: Dashboard par **Withdraw Panel** par jayen, apna target account select karen (Easypaisa, JazzCash, SadaPay ya Pakistani Bank Account) aur request submit karen.
2. **Review Time**: Hamara security audit system automatic checks ke baad **10 se 30 minutes** (maximum 1 se 2 ghante) me withdrawals approve kar deta hai, jo direct aapke account me transfer ho jata hai.
3. **Minimum Limit**: Minimum withdrawal limit PKR 100 ya $1 hai. 

🛡️ MoneyMind Governance Core live review ensures absolute financial security! Let us know if you need any other help.`;
  }
  
  if (norm.includes("deposit") || norm.includes("paisa") || norm.includes("jazz") || norm.includes("sada") || norm.includes("naya") || norm.includes("bank") || norm.includes("add money") || norm.includes("pese kese") || norm.includes("pese kaise") || norm.includes("invest") || norm.includes("payment")) {
    return `**Deposit aur Investment Steps:** 💸

1. Dashboard me **Deposit Panel** button click karen.
2. Select your channel: **Easypaisa, JazzCash, SadaPay, NayaPay, Bank Transfer, or USDT (TRC-20)**.
3. Diye gaye Account Number / details par payment transfer karen.
4. Us ke baad, Sender Name, Sender Account, aur **TxID / Receipt Reference** form me likhain aur submit karen.
5. MoneyMind automatic ledger verification system check karke balances direct update kar deta hai!

Daily staking profits is ke baad automatically collect hote rehte hain! 🚀`;
  }

  if (norm.includes("ia feature") || norm.includes("ai feature") || norm.includes("ai help") || norm.includes("artificial") || norm.includes("kon kon") || norm.includes("features")) {
    return `**MoneyMind Space Premium AI & Ledger Features:** 🤖

1. **MindBuddy AI Assistant** (This Chatbot!): Instant Roman Urdu, English, aur Urdu me queries answers karke support provide karta hai.
2. **Intelligent Security Ledger**: Automatic fraud detection, IP matching, aur fast unbanning checks handle karta hai.
3. **Telegram Live Webhook Bot**: Technical logs aur important updates Telegram servers par real-time broadcast karta hai taake admins instant and safe review kar saken.
4. **Dynamic Governance Pulsing Charts**: Dashboard par real-time revenue, registration flow charts aur secure ledger feed show karta hai.

Security audits are active 24/7! 🛡️`;
  }

  if (norm.includes("earn") || norm.includes("paise") || norm.includes("pese") || norm.includes("kamaen") || norm.includes("kese") || norm.includes("plan") || norm.includes("packages") || norm.includes("invest") || norm.includes("refer") || norm.includes("invite") || norm.includes("dost") || norm.includes("commission")) {
    return `**Earning & Referrals Commission Rules:** 📈

1. **Staking Plans**: Alag alag investment plans hain jinse aap **daily passive income** earn kar sakte hain status level ke mutabiq.
2. **Referral Program (3 Levels Tier)**:
   - **Level 1 (Direct)**: Aap ko direct referral par percentage commission milta hai.
   - **Level 2**: Aap ke referral ka referral join karega tou mazeed commission milega.
   - **Level 3**: Multi-generational tier reward of passive returns.
3. **Daily Login Bonus**: Har 24 ghante baad daily bonus reward claim karna mat bhulen!

🔥 Apne refer code ko copy karke friends ke sath share karen aur dynamic returns hasil karen.`;
  }

  if (norm.includes("hello") || norm.includes("hi") || norm.includes("asalam") || norm.includes("hey") || norm.includes("kia hal") || norm.includes("kese ho") || norm.includes("hola") || norm.includes("greetings")) {
    return `Asalam-o-Alaikum! Hello! 👋 Main aapka **MindBuddy AI Companion** hoon.

Main premium financial assistant hoon jo Urdu, Roman Urdu aur English me perfect help kar sakta hai. 
Aap mujh se ye pooch sakte hain:
- *Withdrawal review ka kitna time hai?*
- *AI features kon konsey hain?*
- *Deposit kese karen?*
- *Paise kamaane ka tarika?*

Hum humesha aapko 24/7 live guide karne ke liye hazir hain! Custom plan choose karen aur stakings start karen! 💰`;
  }

  return `Shukriya hum se rabta karne ka! 🌟 MoneyMind Space high-yield staking aur referral networks me sab se secure aur fast service provide karta hai.

- Agar aap **deposit/pese add** karna chahte hain, dashboard me 'Deposit Panel' click karen.
- Agar aap **withdrawal/payout** poochna chahte hain, 'Withdraw Panel' click karen (System reviews and verifies this under 10-30 mins).
- Agar aap koi **plan choose** karna chahte hain, 'Buy Plan' matrix check karen.

Aapka koi makhsoos sawal hai tou be-jhijhak likhein, main Roman Urdu aur English dono me active hoon! 🛡️`;
};

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: string;
}

export default function LiveChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Asalam-o-Alaikum! 💰 Main aapka **MindBuddy AI Companion** hoon. Main real-time Roman Urdu, Urdu aur English me MoneyMind Space ke sawalat ke jawab de sakta hoon. Mujh se poochain: \n- *Paise kese kamaen?*\n- *AI features kon konsey hain?*\n- *Deposit aur withdrawal ka aasan tarika kya hai?*",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // Keep track of chat history for dynamic context
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; text: string }[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat list whenever messages update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  // Handle preset quick-action questions
  const quickQuestions = [
    { label: "🤖 AI Features?", text: "IA features kon koncy hain aur hume kese help karte hain?" },
    { label: "💰 Paise Kese Kamaen?", text: "How to earn money and what are investment plans?" },
    { label: "💸 Deposit Steps?", text: "How can I deposit money through Easypaisa or JazzCash?" },
    { label: "🛡️ Withdrawal & Rules?", text: "Withdrawal kese nikalen aur security review kitna time leta hai?" },
  ];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatHistory((prev) => [...prev, { role: "user", text: textToSend }]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: chatHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Server response not ok: " + response.status);
      }

      const data = await response.json();
      
      setIsTyping(false);

      if (data && data.reply) {
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: data.reply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, botMsg]);
        setChatHistory((prev) => [...prev, { role: "assistant", text: data.reply }]);
        
        // Play premium Web Audio sound effect on reply receiving
        try {
          playSound("new_referral");
        } catch (e) {
          console.warn("Sound play failed", e);
        }
      } else {
        throw new Error("Invalid reply format payload from endpoint");
      }
    } catch (err) {
      console.warn("Server chatbot backend trace failed, triggering instant client intelligent fallback: ", err);
      setIsTyping(false);
      
      const fallbackReply = getClientFallbackReply(textToSend);
      
      const botMsg: Message = {
        id: `bot-fallback-${Date.now()}`,
        sender: "bot",
        text: fallbackReply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setChatHistory((prev) => [...prev, { role: "assistant", text: fallbackReply }]);

      try {
        playSound("new_referral");
      } catch (e) {
        console.warn("Sound play failed", e);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 select-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="absolute bottom-16 right-0 w-[360px] max-w-[calc(100vw-2.5rem)] h-[480px] bg-[#111111]/95 border border-white/10 rounded-3xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden backdrop-blur-xl"
            id="mindbuddy-chat-panel"
          >
            {/* Elegant Header with Glowing Pulse */}
            <div className="bg-gradient-to-b from-zinc-900 to-[#121212] border-b border-white/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-blue-400 relative">
                  <Bot className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-black animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.15em] text-blue-400 flex items-center gap-1">
                    MindBuddy AI
                  </h3>
                  <p className="text-[8px] text-white/35 uppercase tracking-wider font-mono">Live MoneyMind Support</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl border border-white/5 bg-transparent hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrolling Chat Message Body Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} items-start gap-2.5`}
                >
                  {msg.sender === "bot" && (
                    <div className="w-6 h-6 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] shrink-0 mt-0.5 font-bold">
                      MB
                    </div>
                  )}
                  <div className="flex flex-col max-w-[80%]">
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-[10px] leading-relaxed whitespace-pre-line ${
                        msg.sender === "user"
                          ? "bg-gradient-to-r from-blue-600 to-[#B29430] text-black font-medium rounded-tr-sm shadow-md"
                          : "bg-white/[0.04] border border-white/5 text-white/85 rounded-tl-sm font-sans"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[7.5px] font-mono text-white/20 mt-1 uppercase tracking-wider self-end px-1">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {/* Typing State */}
              {isTyping && (
                <div className="flex justify-start items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] shrink-0 font-bold">
                    MB
                  </div>
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Interactive Suggested Questions Drawer */}
            <div className="px-4 py-2 bg-slate-950/40 border-t border-white/5 space-y-1.5">
              <span className="text-[7.5px] text-white/30 uppercase tracking-[0.14em] font-black flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-blue-400 animate-pulse" /> Recommended Quick Questions
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pb-1 scrollbar-thin">
                {quickQuestions.map((qq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(qq.text)}
                    className="text-[8px] font-medium tracking-wide bg-white/[0.03] border border-white/5 hover:border-blue-500/30 text-white/60 hover:text-white hover:bg-white/[0.07] px-2.5 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap"
                  >
                    {qq.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Input Input Area Form */}
            <form
              onSubmit={handleFormSubmit}
              className="p-3 bg-zinc-950 border-t border-white/5 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask MindBuddy anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-[#090909] border border-white/5 focus:border-blue-500/45 rounded-xl px-4 py-3 text-[10px] text-white placeholder-white/30 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-[#B29430] hover:brightness-110 active:scale-95 text-black flex items-center justify-center transition-all cursor-pointer border-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating launcher trigger button badge */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-[#B29430] text-black shadow-2xl flex items-center justify-center cursor-pointer relative border-0 z-50 group"
        id="mindbuddy-chat-launcher"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 45, opacity: 0 }}
            >
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -45, opacity: 0 }}
              className="relative"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-black animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-black" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
