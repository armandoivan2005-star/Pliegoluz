import type { Metadata } from "next";
import Link from "next/link";
import { FirebaseAuthForm } from "@/components/firebase-auth-form";

export const metadata: Metadata = { title: "Acceso editorial" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b0e0d] px-5 py-12 text-[#f5efe3]">
      <div className="w-full max-w-md">
        <Link href="/" className="font-serif text-xl tracking-[.22em] text-[#d5bd87]">PLIEGOLUZ</Link>
        <section className="mt-8 rounded-3xl border border-white/10 bg-[#121513] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-[#aa8c57]">Administración</p>
          <h1 className="mt-4 font-serif text-4xl">Iniciar sesión</h1>
          <p className="mt-3 text-sm leading-6 text-[#918e86]">Accede con Google o con tu cuenta de Pliegoluz.</p>
          <FirebaseAuthForm mode="login" initialError={error} />
        </section>
        <Link href="/" className="mt-5 flex h-11 w-full items-center justify-center rounded-xl border border-white/10 text-sm text-[#aaa79f] transition hover:border-[#c6a86d]/45 hover:text-[#f5efe3]">← Volver al inicio</Link>
        <p className="mt-5 text-center text-xs text-[#6f6d67]">La autenticación se procesa de forma segura con Firebase.</p>
      </div>
    </main>
  );
}
