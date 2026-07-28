import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { googleAuthEnabled } from "@/lib/runtime-config";
import logoImg from "@assets/Logo_1772310414809.png";

function GoogleLogo() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.26-2.09 3.58-5.17 3.58-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.21 7.21 0 0 1 4.9 12c0-.8.14-1.57.38-2.29V6.62H1.27a12 12 0 0 0 0 10.76l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.09C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

export default function Login() {
  const [oauthError, setOauthError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "unauthorized") {
      setOauthError(
        "That Google account has not been granted access to Invoice Creator. Ask an administrator to add your email.",
      );
    } else if (params.get("error") === "email_unverified") {
      setOauthError(
        "Your Google account's email address is not verified with Google. Verify it in your Google account settings, then sign in again.",
      );
    } else if (params.get("error") === "auth_failed") {
      setOauthError("Google sign-in failed. Please try again.");
    }
    if (params.has("error")) window.history.replaceState({}, "", "/");
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoImg} alt="Excel Aquatics" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-xl">Excel Aquatics Invoice Creator</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in with your Excel Aquatics staff Google account
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {oauthError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{oauthError}</AlertDescription>
            </Alert>
          )}
          {googleAuthEnabled ? (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={redirecting}
              onClick={() => {
                setRedirecting(true);
                window.location.href = "/api/auth/google";
              }}
              data-testid="button-google-signin"
            >
              <GoogleLogo />
              {redirecting ? "Redirecting to Google…" : "Sign in with Google"}
            </Button>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Google sign-in is not configured for this deployment. Set
                GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
