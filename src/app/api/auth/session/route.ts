import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { FIREBASE_SESSION_COOKIE, FIREBASE_SESSION_MAX_AGE } from "@/lib/firebase/session";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createAdminClient } from "@/lib/supabase/admin";

type SessionRequest = { idToken?: string };

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  try {
    const { idToken } = (await request.json()) as SessionRequest;
    if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 10_000) {
      return NextResponse.json({ error: "El token de Firebase no es válido." }, { status: 400 });
    }

    const firebaseAuth = getFirebaseAdminAuth();
    const decoded = await firebaseAuth.verifyIdToken(idToken, true);
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (!decoded.auth_time || nowInSeconds - decoded.auth_time > 5 * 60) {
      return NextResponse.json({ error: "El inicio de sesión ya no es reciente." }, { status: 401 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase Admin no está configurado." }, { status: 500 });
    }

    const { data: profile, error } = await supabase
      .from("firebase_profiles")
      .upsert(
        {
          firebase_uid: decoded.uid,
          email: decoded.email?.toLowerCase() ?? null,
          display_name: decoded.name ?? decoded.email ?? "Lector",
          photo_url: decoded.picture ?? null,
          email_verified: decoded.email_verified ?? false,
          provider: decoded.firebase?.sign_in_provider ?? "unknown",
          last_sign_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "firebase_uid" },
      )
      .select("id, role, suspended_at")
      .single<{ id: string; role: "reader" | "author" | "admin"; suspended_at: string | null }>();

    if (error || !profile) {
      return NextResponse.json(
        { error: "No se pudo vincular el usuario con Supabase. Ejecuta supabase/firebase-auth.sql." },
        { status: 500 },
      );
    }

    if (profile.suspended_at) {
      return NextResponse.json({ error: "Esta cuenta está suspendida." }, { status: 403 });
    }

    const sessionCookie = await firebaseAuth.createSessionCookie(idToken, {
      expiresIn: FIREBASE_SESSION_MAX_AGE * 1000,
    });

    const response = NextResponse.json({ profileId: profile.id, role: profile.role });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: FIREBASE_SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (caught) {
    const code =
      typeof caught === "object" && caught !== null && "code" in caught
        ? String(caught.code)
        : "unknown";
    console.error("Firebase session error", { code });

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `No se pudo verificar la cuenta de Firebase (${code}).`
            : "No se pudo verificar la cuenta de Firebase.",
      },
      { status: 401 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(FIREBASE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
