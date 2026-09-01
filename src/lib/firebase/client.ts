"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let browserAuth: Auth | null | undefined;

export function getFirebaseBrowserAuth() {
  if (browserAuth !== undefined) return browserAuth;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    browserAuth = null;
    return browserAuth;
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({ apiKey, authDomain, projectId, appId });

  browserAuth = getAuth(app);
  return browserAuth;
}
