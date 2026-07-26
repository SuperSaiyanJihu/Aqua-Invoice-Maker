declare global {
  interface Window {
    __AQUA_INVOICE_CONFIG__?: {
      clerkPublishableKey?: string;
      googleBreakGlassEnabled?: boolean;
    };
  }
}

function normalizeKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  return /^(?:pk_test_|pk_live_)[A-Za-z0-9_=$-]{32,}$/.test(key)
    ? key
    : undefined;
}

export const clerkPublishableKey =
  normalizeKey(window.__AQUA_INVOICE_CONFIG__?.clerkPublishableKey) ??
  normalizeKey(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

export const googleBreakGlassEnabled =
  window.__AQUA_INVOICE_CONFIG__?.googleBreakGlassEnabled === true;
