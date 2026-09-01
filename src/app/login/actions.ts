"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/session";

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(FIREBASE_SESSION_COOKIE);
  redirect("/login");
}
