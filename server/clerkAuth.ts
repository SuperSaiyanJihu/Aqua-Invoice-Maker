import { createClerkClient, verifyToken } from "@clerk/backend";

export type ClerkIdentity = {
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

function getSecretKey(): string | undefined {
  return process.env.CLERK_SECRET_KEY?.trim() || undefined;
}

export function isClerkConfigured(): boolean {
  return Boolean(getSecretKey());
}

function getClerkClient() {
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not configured");
  return createClerkClient({ secretKey });
}

export async function verifyClerkBearerToken(token: string): Promise<ClerkIdentity> {
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not configured");

  const payload = await verifyToken(token, { secretKey });
  if (!payload.sub) throw new Error("Clerk token missing subject");

  const user = await getClerkClient().users.getUser(payload.sub);
  const primary =
    user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId) ??
    user.emailAddresses[0];
  const email = primary?.emailAddress?.trim().toLowerCase();
  if (!email) throw new Error("Clerk user has no email address");
  if (primary.verification?.status !== "verified") {
    throw new Error("Clerk email address is not verified");
  }

  return {
    clerkUserId: payload.sub,
    email,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
  };
}

export async function inviteEmailToClerk(
  email: string,
): Promise<{ invited: boolean; alreadyExists?: boolean; error?: string }> {
  if (!isClerkConfigured()) return { invited: false, error: "Clerk is not configured" };

  const normalized = email.trim().toLowerCase();
  try {
    const client = getClerkClient();
    const existing = await client.users.getUserList({
      emailAddress: [normalized],
      limit: 1,
    });
    if (existing.data.length > 0) return { invited: false, alreadyExists: true };

    await client.invitations.createInvitation({
      emailAddress: normalized,
      redirectUrl: process.env.APP_URL || undefined,
    });
    return { invited: true };
  } catch (error: any) {
    const message =
      error?.errors?.[0]?.message || error?.message || "Failed to invite user";
    if (/already|exist|pending/i.test(message) || error?.status === 409 || error?.status === 422) {
      return { invited: false, alreadyExists: true, error: message };
    }
    return { invited: false, error: message };
  }
}
