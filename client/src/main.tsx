import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ClerkProvider } from "@clerk/clerk-react";
import { clerkPublishableKey } from "./lib/runtime-config";

const root = createRoot(document.getElementById("root")!);

root.render(
  clerkPublishableKey ? (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  ) : (
    <App />
  ),
);
