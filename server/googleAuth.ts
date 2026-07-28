import { OAuth2Client } from "google-auth-library";

function appBaseUrl(): string {
  const value = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (value) return value;
  if (process.env.NODE_ENV !== "production") {
    return `http://localhost:${process.env.PORT || 5000}`;
  }
  throw new Error("APP_URL must be set in production for Google OAuth");
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return `${appBaseUrl()}/api/auth/google/callback`;
}

function client(): OAuth2Client {
  if (!isGoogleOAuthConfigured()) throw new Error("Google OAuth is not configured");
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri(),
  );
}

export function googleAuthUrl(state: string): string {
  return client().generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const oauth = client();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.id_token) throw new Error("Google did not return an ID token");
  const ticket = await oauth.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error("Google token missing email");
  return {
    email: payload.email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
  };
}
