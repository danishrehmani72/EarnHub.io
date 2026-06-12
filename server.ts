import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// Initialize Gemini SDK with telemetry User-Agent header
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    })
  : null;

// Middleware for body parsing
app.use(express.json());

// API route to dispatch OTP codes to user emails via SMTP
app.post("/api/send-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email and Verification Code are required." });
  }

  let hostStr = (process.env.EMAIL_SMTP_HOST || "smtp.gmail.com").trim();
  const host = hostStr.split(" ")[0] || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_SMTP_PORT || "465");
  const secure = process.env.EMAIL_SMTP_SECURE !== "false";
  const user = process.env.EMAIL_SMTP_USER?.trim();
  const pass = process.env.EMAIL_SMTP_PASS?.trim();

  if (!user || !pass) {
    return res.json({ success: true, mode: "demo", message: "Demo mode: No SMTP credentials." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: `"MoneyMind Space" <${user}>`,
      to: email,
      subject: `[MoneyMind Space] Your Verification Code: ${code}`,
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <strong>${code}</strong></p>`
    });

    return res.json({ success: true, mode: "live" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: `SMTP Error: ${err.message || 'Unknown'}` });
  }
});

// API route to notify users about transaction status changes
app.post("/api/send-tx-notification", async (req, res) => {
  const { email, userName, type, status, amount } = req.body;
  if (!email || !type || !status) {
    return res.status(400).json({ error: "Required fields missing." });
  }

  let hostStr = (process.env.EMAIL_SMTP_HOST || "smtp.gmail.com").trim();
  const host = hostStr.split(" ")[0] || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_SMTP_PORT || "465");
  const secure = process.env.EMAIL_SMTP_SECURE !== "false";
  const user = process.env.EMAIL_SMTP_USER?.trim();
  const pass = process.env.EMAIL_SMTP_PASS?.trim();

  if (!user || !pass) {
    return res.json({ success: true, message: "Demo mode: No SMTP credentials." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"MoneyMind Space" <${user}>`,
      to: email,
      subject: `[MoneyMind Space] Your ${type.charAt(0).toUpperCase() + type.slice(1)} has been ${status.toUpperCase()}`,
      text: `Hello ${userName || 'User'},\n\nYour ${type} of $${amount?.toFixed(2) || 'N/A'} has been ${status}.\n\nBest regards,\nMoneyMind Space Administration`,
      html: `<p>Hello ${userName || 'User'},</p><p>Your ${type} of $${amount?.toFixed(2) || 'N/A'} has been ${status}.</p>`
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: `SMTP Error: ${err.message || 'Unknown'}` });
  }
});

// Live Chat Bot AI assistant route using gemini-3.5-flash model
app.post("/api/chat-bot", async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const normalized = message.toLowerCase().trim();

  // Smart localized fallback content
  const getFallbackReply = (msg: string): string => {
    if (msg.includes("ia feature") || msg.includes("ai feature") || msg.includes("ai help") || msg.includes("kon kon")) {
      return `**MoneyMind Space** includes these premium AI & Automated features:
1. **MindBuddy AI Companion**: Instantly answers queries in Roman Urdu, Urdu, or English.
2. **Dynamic Transaction Ledger**: Live platform action feed logging entries in real-time.
3. **Telegram Live Webhook Dispatch**: Automated bot notifications to developers for secure validation of actions.
4. **Active Security Shields**: Continuous fraud alerts and unban filters.`;
    }
    if (msg.includes("earnhub") || msg.includes("money") || msg.includes("mind") || msg.includes("platform")) {
      return `**MoneyMind Space** is a high-yield staking and referral network where you can:
- Securely deposit PKRs via **Easypaisa, JazzCash, SadaPay, bank** or **USDT/TRC-20**.
- Choose highly optimized plans for continuous returns.
- Earn up to 3 levels of generational parent commissions through referrals!`;
    }
    if (msg.includes("deposit") || msg.includes("paisa") || msg.includes("jazz") || msg.includes("bank") || msg.includes("invest")) {
      return `To **Deposit** or **Invest**:
1. Click the **Deposit Panel** on your home dashboard.
2. Select your preferred channel (e.g. **Easypaisa**, **JazzCash**, **SadaPay**, **NayaPay**, or **Bank Transfer** / **USDT**).
3. Transfer the amount to the provided details and submit your Transaction details (Sender Name, Account, TxID).
4. Our security ledger verifies this instantly to update your stable balances!`;
    }
    if (msg.includes("withdraw") || msg.includes("nikal") || msg.includes("payout")) {
      return `To **Withdraw** your earnings:
1. Navigate to the **Withdraw Panel** on your dashboard.
2. Choose your payout gate (**Easypaisa**, **JazzCash**, **SadaPay**, or bank account).
3. Input your clean account details and click trigger.
4. Danish (our chief administrator) reviews and pushes instant disbursements safely!`;
    }
    if (msg.includes("refer") || msg.includes("invite") || msg.includes("friend") || msg.includes("dost")) {
      return `Aap apne doston ko invite kar ke **3 Levels** tak commission earn kar saktay hain!
- **Level 1**: Direct friends you introduce.
- **Level 2**: Friends introduced by your Level 1 referrals.
- **Level 3**: Multi-generation tier rewards for compound expansion!`;
    }
    if (msg.includes("hello") || msg.includes("hi") || msg.includes("asalam") || msg.includes("hey") || msg.includes("kia hal") || msg.includes("kese ho")) {
      return `Hello! Main aapka **MindBuddy AI Companion** hoon. Main real-time Urdu, English aur Roman Urdu me platform ke talluq se aapke sawalaat ke jawaab de sakta hoon. Aap mujh se plans, deposit, ya withdrawal pooch saktay hain!`;
    }
    return `Shukriya hum se rabta karne ka! MoneyMind Space me aap secure investment plan select kar ke stakings se daily profit generate kar sakte hain. Agat aap ka koi makhsoos sawal hai, to zarur batayein!`;
  };

  try {
    if (ai) {
      // Build brief chat elements formatting
      const systemInstruction = `
You are "MindBuddy", the highly advanced, helpful, and sophisticated AI Live Chat Assistant for the "MoneyMind Space" platform.
MoneyMind Space is an upgraded, secure financial growth, staking, and referral platform.
Key Info:
- Pakistan Rails supported: Easypaisa, JazzCash, SadaPay, NayaPay, Bank Transfers.
- Crypto Rails: USDT (TRC-20), Bitcoin, Ethereum.
- Features: Flexible investment plans, micro staking rewards, referral commission tiers (Level 1, Level 2, Level 3), daily login bonuses, and secure instant payouts.
- Chief Administrator: Danish (Operator ID: DANISH125).

Guideline regarding answers:
1. Speak the language the user speaks. If the user asks in Roman Urdu (e.g. "IA features kon koncy hain", "kia hal hai", "pese kese kamaen"), answer them in Roman Urdu with high energy and premium support!
2. If they ask in English, write elegantly in English. If they ask in Urdu (Nastaliq script), write beautifully in Urdu.
3. Keep answers highly professional, positive, crisp, and structured. Use emojis occasionally (e.g., 💰, 🔥, ⚡, 🛡️, 📞) to keep chat engaging and friendly, but not cluttered.
4. If a user asks "IA features kon koncy hain/What are the AI features of the platform?", explain that MoneyMind Space features:
   - MindBuddy AI Assistant: Answers questions instantly, guides on plans, deposits, and withdrawal steps in Urdu, Roman Urdu, or English.
   - Intelligent Security Ledger: Real-time fraud detection and instant multi-factor transaction check.
   - Automated Telegram Live Webhook Feeds: Real-time notification BOT dispatchers to admins for instant secure updates.
   - Dynamic Financial Analytics: Real-time revenue, registration flow charts and active ledger feeds.
5. Remind users that Danish reviews all operations for supreme processing security!
`;

      const contents = history && Array.isArray(history) && history.length > 0
        ? [...history.map((h: any) => ({ role: h.role === "assistant" ? "model" as const : "user" as const, parts: [{ text: h.text }] })), { role: "user" as const, parts: [{ text: message }] }]
        : [{ role: "user" as const, parts: [{ text: message }] }];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const reply = response.text || getFallbackReply(normalized);
      return res.json({ reply });
    } else {
      // Fallback response
      const reply = getFallbackReply(normalized);
      return res.json({ reply });
    }
  } catch (err: any) {
    console.error("Gemini chatbot error:", err);
    // Silent recovery with elegant fallback reply
    const reply = getFallbackReply(normalized);
    return res.json({ reply });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Full-stack server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
