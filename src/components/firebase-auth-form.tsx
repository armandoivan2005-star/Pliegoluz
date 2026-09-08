"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseBrowserAuth } from "@/lib/firebase/client";

type AuthMode = "login" | "register";
type SessionResponse = { role?: "reader" | "editor" | "admin"; error?: string };

function firebaseMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) return "No se pudo completar el acceso. Inténtalo otra vez.";

  switch (error.code) {
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con ese correo.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "El correo o la contraseña no son correctos.";
    case "auth/invalid-email":
      return "Escribe un correo válido.";
    case "auth/weak-password":
      return "La contraseña no cumple los requisitos de seguridad.";
    case "auth/popup-closed-by-user":
      return "La ventana de Google se cerró antes de terminar.";
    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana de Google.";
    case "auth/account-exists-with-different-credential":
      return "Ese correo ya está vinculado a otro método de acceso.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";
    default:
      return "Firebase no pudo completar el acceso.";
  }
}

export function FirebaseAuthForm({ mode, initialError }: { mode: AuthMode; initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError ?? "");
  const [pending, setPending] = useState(false);

  async function createServerSession(user: User) {
    const idToken = await user.getIdToken(true);
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const result = (await response.json()) as SessionResponse;
    if (!response.ok) throw new Error(result.error ?? "No se pudo crear la sesión.");
    return result;
  }

  async function finishAccess(user: User) {
    const auth = getFirebaseBrowserAuth();
    let result: SessionResponse;
    try {
      result = await createServerSession(user);
    } finally {
      if (auth) await signOut(auth);
    }
    router.replace(result.role === "editor" || result.role === "admin" ? "/dashboard" : "/");
    router.refresh();
  }

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setPending(true);

    try {
      const auth = getFirebaseBrowserAuth();
      if (!auth) throw new Error("Firebase no está configurado en el navegador.");
      await setPersistence(auth, inMemoryPersistence);

      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");

      if (mode === "register") {
        const displayName = String(formData.get("display_name") ?? "").trim();
        const confirmation = String(formData.get("password_confirmation") ?? "");
        if (displayName.length < 2) throw new Error("Escribe tu nombre.");
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");

        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName });
        await finishAccess(credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await finishAccess(credential.user);
      }
    } catch (caught) {
      setError(caught instanceof Error && !(caught instanceof FirebaseError) ? caught.message : firebaseMessage(caught));
      setPending(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setPending(true);

    try {
      const auth = getFirebaseBrowserAuth();
      if (!auth) throw new Error("Firebase no está configurado en el navegador.");
      await setPersistence(auth, inMemoryPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      await finishAccess(credential.user);
    } catch (caught) {
      setError(caught instanceof Error && !(caught instanceof FirebaseError) ? caught.message : firebaseMessage(caught));
      setPending(false);
    }
  }

  return (
    <>
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-400/25 bg-red-400/8 px-4 py-3 text-sm text-red-200">{error}</p>}

      <button type="button" onClick={handleGoogle} disabled={pending} className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/12 bg-white/[.04] text-sm font-semibold text-[#eee8dc] transition hover:bg-white/[.08] disabled:cursor-wait disabled:opacity-60">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.89h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.37Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.4l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.91A6 6 0 0 1 6.08 12c0-.66.11-1.3.32-1.91v-2.6H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.51l3.34-2.6Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.8.51 3.84 1.5l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.6c.79-2.37 3-4.13 5.6-4.13Z"/></svg>
        Continuar con Google
      </button>

      <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[.2em] text-[#68665f]"><span className="h-px flex-1 bg-white/10" />o usa tu correo<span className="h-px flex-1 bg-white/10" /></div>

      <form method="post" onSubmit={handleCredentials} className="space-y-5">
        {mode === "register" && (
          <label className="block text-sm text-[#c7c0b4]">Nombre
            <input name="display_name" type="text" autoComplete="name" minLength={2} required className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-black/20 px-4 text-white outline-none transition focus:border-[#c6a86d]/70" />
          </label>
        )}
        <label className="block text-sm text-[#c7c0b4]">Correo
          <input name="email" type="email" autoComplete="email" required className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-black/20 px-4 text-white outline-none transition focus:border-[#c6a86d]/70" />
        </label>
        <label className="block text-sm text-[#c7c0b4]">Contraseña
          <input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : 6} required className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-black/20 px-4 text-white outline-none transition focus:border-[#c6a86d]/70" />
        </label>
        {mode === "register" && (
          <label className="block text-sm text-[#c7c0b4]">Confirmar contraseña
            <input name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-black/20 px-4 text-white outline-none transition focus:border-[#c6a86d]/70" />
          </label>
        )}
        <button disabled={pending} className="h-12 w-full rounded-xl bg-[#e8ddc6] text-sm font-semibold text-[#171816] transition hover:bg-white disabled:cursor-wait disabled:opacity-60">
          {pending ? "Procesando…" : mode === "register" ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-[#88857e]">
        {mode === "register" ? "¿Ya tienes cuenta?" : "¿Todavía no tienes cuenta?"}{" "}
        <Link href={mode === "register" ? "/login" : "/registro"} className="font-semibold text-[#d5bd87] hover:text-white">
          {mode === "register" ? "Inicia sesión" : "Regístrate"}
        </Link>
      </p>
    </>
  );
}
