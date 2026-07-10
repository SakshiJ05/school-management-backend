import nodemailer from 'nodemailer';

const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendOtpEmail(to, otp, purpose = 'verification') {
  const appName = process.env.APP_NAME || 'Scholify';
  const subject = `${appName} OTP verification`;
  const text = `Your ${appName} ${purpose} OTP is ${otp}. It is valid for 10 minutes.`;

  if (!smtpReady) {
    console.log(`[MAIL:DEV] ${subject} -> ${to}: ${otp}`);
    return { sent: false, dev: true };
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
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: `<p>Your <strong>${appName}</strong> ${purpose} OTP is:</p><h2>${otp}</h2><p>This code is valid for 10 minutes.</p>`,
    });

    console.log(`[MAIL] Sent OTP email to ${to}`);
    return { sent: true, dev: false };
  } catch (error) {
    console.error('[MAIL] Failed to send OTP email:', error);
    return { sent: false, error };
  }
}
