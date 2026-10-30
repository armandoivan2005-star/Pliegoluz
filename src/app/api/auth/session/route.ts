import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { FIREBASE_SESSION_COOKIE, FIREBASE_SESSION_MAX_AGE } from "@/lib/firebase/session";
import { getDatabase, isDatabaseConfigured } from "@/lib/postgres";
import { isSameOriginRequest } from "@/lib/request-origin";

type SessionRequest = { idToken?: string };
type SessionProfile = {
  id: string;
  role: "reader" | "author" | "admin";
  suspended_at: Date | null;
};

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
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "PostgreSQL no está configurado." }, { status: 500 });
    }

    const { rows } = await getDatabase().query<SessionProfile>(
      `insert into public.firebase_profiles (
         firebase_uid, email, display_name, photo_url, email_verified,
         provider, last_sign_in_at, updated_at
       ) values ($1, $2, $3, $4, $5, $6, now(), now())
       on conflict (firebase_uid) do update set
         email = excluded.email,
         display_name = excluded.display_name,
         photo_url = excluded.photo_url,
         email_verified = excluded.email_verified,
         provider = excluded.provider,
         last_sign_in_at = now(),
         updated_at = now()
       returning id, role, suspended_at`,
      [
        decoded.uid,
        decoded.email?.toLowerCase() ?? null,
        decoded.name ?? decoded.email ?? "Lector",
        decoded.picture ?? null,
        decoded.email_verified ?? false,
        decoded.firebase?.sign_in_provider ?? "unknown",
      ],
    );
    const profile = rows[0];
    if (!profile) {
      return NextResponse.json({ error: "No se pudo crear el perfil en PostgreSQL." }, { status: 500 });
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
    const code = typeof caught === "object" && caught !== null && "code" in caught
      ? String(caught.code)
      : "unknown";
    console.error("Firebase/PostgreSQL session error", { code });
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === "development"
          ? `No se pudo verificar la cuenta o guardar el perfil (${code}).`
          : "No se pudo verificar la cuenta.",
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
