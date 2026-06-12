import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

const app = express();
const PORT = 3000;

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
