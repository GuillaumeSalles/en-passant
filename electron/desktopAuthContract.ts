import { parseSetCookieHeader } from "better-auth/cookies";
import { API_ORIGIN, ELECTRON_AUTH_CALLBACK_PATH, ELECTRON_AUTH_SCHEME } from "./constants";

export type DesktopAuthEvent = "signin" | "signup";

const BETTER_AUTH_SESSION_COOKIE_NAMES = new Set([
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_data",
]);

type CookieSession = {
  cookies: {
    set: (details: Electron.CookiesSetDetails) => Promise<void>;
  };
};

export type ParsedDesktopAuthDeepLink = {
  authEvent: DesktopAuthEvent;
  token: string;
};

export function parseDesktopAuthDeepLink(value: string): ParsedDesktopAuthDeepLink | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== `${ELECTRON_AUTH_SCHEME}:` ||
    url.hostname !== "" ||
    url.pathname !== ELECTRON_AUTH_CALLBACK_PATH
  ) {
    return null;
  }
  const authEvent = url.searchParams.get("auth_event");
  if (authEvent !== "signin" && authEvent !== "signup") return null;
  if (!url.hash.startsWith("#token=")) return null;
  const token = url.hash.slice("#token=".length);
  return token === "" ? null : { authEvent, token };
}

function electronSameSite(
  sameSite: "strict" | "lax" | "none" | undefined,
): NonNullable<Electron.CookiesSetDetails["sameSite"]> {
  if (sameSite === "none") return "no_restriction";
  return sameSite ?? "lax";
}

export async function mirrorAuthCookies(
  desktopSession: CookieSession,
  setCookieHeader: string,
  cookieUrl = API_ORIGIN,
  now = Date.now(),
): Promise<void> {
  const cookies = parseSetCookieHeader(setCookieHeader);
  const defaultSecure = new URL(cookieUrl).protocol === "https:";
  for (const [name, attributes] of cookies) {
    if (!BETTER_AUTH_SESSION_COOKIE_NAMES.has(name)) continue;
    const maxAge = attributes["max-age"];
    const expirationDate =
      typeof maxAge === "number"
        ? now / 1000 + maxAge
        : attributes.expires?.getTime() === undefined
          ? undefined
          : attributes.expires.getTime() / 1000;
    await desktopSession.cookies.set({
      url: cookieUrl,
      name,
      value: attributes.value,
      path: attributes.path ?? "/",
      secure: attributes.secure ?? defaultSecure,
      httpOnly: attributes.httponly ?? true,
      sameSite: electronSameSite(attributes.samesite),
      ...(expirationDate === undefined ? {} : { expirationDate }),
    });
  }
}
