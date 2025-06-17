import { createCookieSessionStorage } from "@remix-run/node";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "turbopic_session",
    secure: false, // для localhost
    secrets: ["turbopic_secret_123"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
  },
});

export const authSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__auth",
    secure: false,
    secrets: ["auth_secret_123"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
  },
});

export let { getSession, commitSession, destroySession } = sessionStorage;