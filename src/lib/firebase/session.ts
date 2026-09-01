import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";

export const FIREBASE_SESSION_COOKIE = "__session";
export const FIREBASE_SESSION_MAX_AGE = 60 * 60 * 24 * 5;

export type FirebaseSessionUser = {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

export const getFirebaseSessionUser = cache(async (): Promise<FirebaseSessionUser | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      displayName: decoded.name ?? decoded.email ?? "Lector",
      emailVerified: decoded.email_verified ?? false,
    };
  } catch {
    return null;
  }
});
