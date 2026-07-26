import { useEffect, useRef, useState } from "react";
import { SignIn, SignedIn, SignedOut, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react";
import { AlertCircle, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  clerkPublishableKey,
  googleBreakGlassEnabled,
} from "@/lib/runtime-config";
import logoImg from "@assets/Logo_1772310414809.png";

function ClerkBridge() {
  const { isSignedIn, getToken } = useClerkAuth();
  const { signOut } = useClerk();
  const { refresh } = useAuth();
  const attempted = useRef(false);
  const [error, setError] = useState("");
  const [bridging, setBridging] = useState(false);

  useEffect(() => {
    if (!isSignedIn || attempted.current) return;
    attempted.current = true;
    setBridging(true);
    setError("");

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Clerk did not provide a session token");
        const response = await fetch("/api/auth/clerk", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "This account is not authorized");
        }
        await refresh();
      } catch (bridgeError: any) {
        setError(bridgeError?.message || "Sign-in could not be completed");
        await signOut().catch(() => undefined);
        attempted.current = false;
      } finally {
        setBridging(false);
      }
    })();
  }, [getToken, isSignedIn, refresh, signOut]);

  if (bridging) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Connecting your account…</p>
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function ClerkLogin() {
  return (
    <>
      <SignedOut>
        <div className="flex justify-center">
          <SignIn
            routing="hash"
            forceRedirectUrl="/"
            signUpUrl={undefined}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "w-full bg-transparent shadow-none border-0",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                footerAction: "hidden",
              },
            }}
          />
        </div>
      </SignedOut>
      <SignedIn>
        <ClerkBridge />
      </SignedIn>
    </>
  );
}

export default function Login() {
  const [oauthError, setOauthError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "unauthorized") {
      setOauthError("That Google account is not authorized as the superadmin.");
    } else if (params.get("error") === "auth_failed") {
      setOauthError("Google authentication failed. Please try again.");
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
            Sign in with your Excel Aquatics staff account
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {oauthError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{oauthError}</AlertDescription>
            </Alert>
          )}
          {!clerkPublishableKey ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Clerk is not configured for this deployment.
              </AlertDescription>
            </Alert>
          ) : (
            <ClerkLogin />
          )}
          {googleBreakGlassEnabled && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = "/api/auth/google";
                }}
              >
                Continue with Google
              </Button>
              <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                Superadmin recovery access only
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
