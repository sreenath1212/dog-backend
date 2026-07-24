import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { sendVerificationEmail } from '../utils/mailer';
import type { RegisterInput, LoginInput } from './auth.validators';

const BCRYPT_ROUNDS = 12;

// ─── Password Helpers ────────────────────────────────────────────────────────

// SECURITY: bcrypt with cost factor 12 — slow enough to resist brute-force,
// fast enough for normal login use.
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Token Helpers ───────────────────────────────────────────────────────────

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
  });
}

export function signRefreshToken(payload: Pick<TokenPayload, 'sub'>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }
}

// ─── Auth Service Functions ──────────────────────────────────────────────────

export async function registerUser(input: RegisterInput) {
  // Check if email already exists (use a generic error to prevent email enumeration)
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // SECURITY: Don't say "email already registered" — that reveals account existence.
    // Instead, tell the user to check their email, which is safe either way.
    throw new AppError(
      409,
      'If this email is not yet registered, you will receive a verification email shortly.'
    );
  }

  const passwordHash = await hashPassword(input.password);

  // Generate a cryptographically secure email verification token
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      emailVerificationToken,
    },
    select: { id: true, name: true, email: true, role: true, isEmailVerified: true },
  });

  // Send verification email (non-blocking — don't fail registration if email fails in dev)
  await sendVerificationEmail(user.email, user.name ?? 'there', emailVerificationToken).catch(
    () => {} // Already handled inside sendVerificationEmail
  );

  return user;
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // SECURITY: Use a constant-time comparison path regardless of whether the user exists.
  // This prevents timing attacks that could reveal whether an email is registered.
  if (!user) {
    // Hash a dummy password to take the same time as a real comparison
    await bcrypt.hash('dummy-timing-protection', BCRYPT_ROUNDS);
    throw new AppError(401, 'Invalid email or password');
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'Invalid email or password');
  }

  // Generate tokens
  const tokenPayload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ sub: user.id });

  // SECURITY: Store a bcrypt hash of the refresh token, not the raw token.
  // The raw token only ever lives in the httpOnly cookie.
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    },
  };
}

export async function refreshTokens(incomingRefreshToken: string) {
  // Verify the token structure and expiry
  const payload = verifyRefreshToken(incomingRefreshToken);

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.refreshTokenHash) {
    throw new AppError(401, 'Invalid refresh token');
  }

  // SECURITY: Verify the incoming token against the stored hash.
  // If the hash doesn't match, this could indicate token theft — invalidate all tokens.
  const isValid = await bcrypt.compare(incomingRefreshToken, user.refreshTokenHash);
  if (!isValid) {
    // Token reuse detected — clear all refresh tokens (token family invalidation)
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
    throw new AppError(401, 'Refresh token reuse detected. Please log in again.');
  }

  // Issue new token pair (rotation)
  const newAccessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  });
  const newRefreshToken = signRefreshToken({ sub: user.id });
  const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: newRefreshTokenHash },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(userId: string): Promise<void> {
  // Invalidate refresh token by clearing the hash
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  });
}

export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: token },
  });

  if (!user) {
    throw new AppError(400, 'Invalid or expired verification token');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null, // Clear the token after use (one-time use)
    },
  });

  return { message: 'Email verified successfully' };
}

export async function resendVerification(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  // SECURITY: Same response whether user exists or not — prevents email enumeration
  if (!user || user.isEmailVerified) return;

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: token },
  });

  await sendVerificationEmail(user.email, user.name ?? 'there', token).catch(() => {});
}
