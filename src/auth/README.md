# Auth Module

## What This Module Does

Handles all user identity operations: registration, login, logout, JWT token management, and email verification.

## How It Works

### Registration Flow
1. User submits name, email, password
2. Password is hashed with bcrypt (cost factor 12) — the plain password is immediately discarded
3. A cryptographically random 32-byte hex token is generated for email verification
4. User record is created in the database
5. Verification email is sent (or logged to console in development)
6. The user cannot access protected resources until email is verified

### Login Flow
1. User submits email and password
2. Email is looked up in the database
3. Password is compared against the bcrypt hash using a constant-time comparison
4. If valid: a 15-minute access token and 7-day refresh token are generated
5. Both tokens are stored as `httpOnly, Secure, SameSite=Strict` cookies — never in the response body
6. The refresh token hash (not the raw token) is stored in the database

### Token Refresh Flow
1. Client sends the refresh token cookie to `POST /api/auth/refresh`
2. The token is verified against the stored bcrypt hash
3. If valid: a new access+refresh token pair is issued (rotation)
4. The old refresh token is invalidated
5. **Reuse detection**: if an already-invalidated refresh token is used, all refresh tokens for that user are immediately invalidated (indicates theft)

### Logout Flow
1. The refresh token hash is cleared from the database
2. Both cookies are cleared in the response
3. The access token will expire naturally (15 minutes max)

## Key Files

| File | Purpose |
|---|---|
| `auth.validators.ts` | Zod schemas for validating register/login request bodies |
| `auth.service.ts` | All business logic: hashing, JWT generation, token rotation |
| `auth.controller.ts` | HTTP request/response handling, cookie setting |
| `auth.router.ts` | Route definitions with per-route documentation |

## Security Decisions

- **bcrypt cost factor 12**: Balances security (slow to brute-force) with performance (login takes ~200ms)
- **Refresh tokens stored as hashes**: If the database is compromised, raw refresh tokens are not exposed
- **Generic error messages**: Login failure says "Invalid email or password" — not "Email not found" or "Wrong password" — preventing account enumeration
- **Email verification not blocking registration**: Registration succeeds immediately; verification is required for protected routes only
- **Constant-time password check**: We hash a dummy string before returning "user not found" to prevent timing attacks that reveal whether an email is registered
- **Refresh token path restriction**: The refresh token cookie is scoped to `/api/auth/refresh` so it is not sent to any other endpoint

## API Routes

See `auth.router.ts` for full documentation of each route including expected request/response formats and possible errors.
