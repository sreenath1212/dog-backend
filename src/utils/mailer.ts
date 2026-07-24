import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

// Create transporter based on environment.
// In development, if SMTP_HOST is not a real server, emails will fail gracefully
// and the link will be logged to the console instead.
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendMail(options: MailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      ...options,
    });
    logger.info(`Email sent to ${options.to}: ${options.subject}`);
  } catch (err) {
    // In development, log the email content to console as a fallback
    if (env.NODE_ENV === 'development') {
      logger.warn(`Email send failed (dev fallback — printing to console):`, {
        to: options.to,
        subject: options.subject,
      });
      // Strip HTML tags for readable console output
      const textContent = options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('\n📧 ===== EMAIL (DEV FALLBACK) =====');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Content: ${textContent}`);
      console.log('===================================\n');
    } else {
      logger.error('Failed to send email', { to: options.to, error: (err as Error).message });
      throw err; // Re-throw in production so callers can handle it
    }
  }
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${env.FRONTEND_URL}/auth/verify-email?token=${token}`;
  await sendMail({
    to,
    subject: 'Verify your PawShop email address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Welcome to PawShop! 🐾</h2>
        <p>Hi ${name},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #7c3aed; color: white;
                  padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link: <code>${verifyUrl}</code></p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't create a PawShop account, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendOrderConfirmationEmail(
  to: string,
  name: string,
  orderId: string,
  totalAmount: number
): Promise<void> {
  const orderUrl = `${env.FRONTEND_URL}/account/orders/${orderId}`;
  const totalRupees = (totalAmount / 100).toFixed(2);
  await sendMail({
    to,
    subject: `PawShop Order Confirmed — ₹${totalRupees}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Order Confirmed! 🐾</h2>
        <p>Hi ${name},</p>
        <p>We've received your payment of <strong>₹${totalRupees}</strong>.</p>
        <a href="${orderUrl}"
           style="display: inline-block; background: #7c3aed; color: white;
                  padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
          View Your Order
        </a>
        <p>We'll notify you when your order ships. Thank you for shopping with us!</p>
      </div>
    `,
  });
}
