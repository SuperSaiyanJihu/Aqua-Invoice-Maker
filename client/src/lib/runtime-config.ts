declare global {
  interface Window {
    __AQUA_INVOICE_CONFIG__?: {
      googleAuthEnabled?: boolean;
    };
  }
}

export const googleAuthEnabled =
  window.__AQUA_INVOICE_CONFIG__?.googleAuthEnabled === true;
