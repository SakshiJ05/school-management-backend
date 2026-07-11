import nodemailer from 'nodemailer';

const requiredSmtpKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const smtpReady = requiredSmtpKeys.every((key) => Boolean(String(process.env[key] || '').trim()));

/** Callers must not promise the user an email we cannot actually send. */
export function isMailConfigured() {
  return smtpReady;
}

export function mailConfigurationStatus() {
  return { configured: smtpReady, missing: requiredSmtpKeys.filter((key) => !String(process.env[key] || '').trim()) };
}

export async function sendOtpEmail(to, otp, purpose = 'verification') {
  const appName = process.env.APP_NAME || 'PathshalaPro';
  const subject = `${appName} OTP verification`;
  const text = `Your ${appName} ${purpose} OTP is ${otp}. It is valid for 10 minutes.`;

  if (!smtpReady) {
    console.log(`[MAIL:DEV] ${subject} -> ${to}: ${otp}`);
    return { sent: false, code: 'SMTP_NOT_CONFIGURED', dev: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Hosts commonly block outbound SMTP. Without these the socket just hangs
      // and the signup request never answers.
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 10_000,
    });

    // Belt and braces: nodemailer's timeouts do not cover every stage of the send.
    await withTimeout(
      transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html: `<p>Your <strong>${appName}</strong> ${purpose} OTP is:</p><h2>${otp}</h2><p>This code is valid for 10 minutes.</p>`,
      }),
      SEND_TIMEOUT_MS,
    );

    console.log(`[MAIL] Sent OTP email to ${to}`);
    return { sent: true, dev: false };
  } catch (error) {
    console.error('[MAIL] Failed to send OTP email:', error.message);
    return { sent: false, code: 'SMTP_SEND_FAILED', reason: error.message };
  }
}

const SEND_TIMEOUT_MS = 12_000;

function withTimeout(promise, ms) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`SMTP send timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}
