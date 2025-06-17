import { sessionStorage } from "./session.server";
import { redirect } from "@remix-run/node";
import {
  getUserByIntegrationToken,
  getUserBySessionToken,
  authenticateBasic,
} from "~/utils/auth.server";

export async function requireUser(request: Request) {
  const auth = request.headers.get("Authorization");

  // 🔐 1. Bearer (Integration token)
  if (auth?.startsWith("Bearer ")) {
    const token = auth.replace("Bearer ", "").trim();
    const user = await getUserByIntegrationToken(token);
    if (user) return user;
  }

  // 🔐 2. Basic (email + password)
  if (auth?.startsWith("Basic ")) {
    const base64 = auth.replace("Basic ", "").trim();
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const [email, password] = decoded.split(":");
    if (email && password) {
      const user = await authenticateBasic(email, password);
      if (user) return user;
    }
  }

  // 🍪 3. Session token from cookie
  const cookie = request.headers.get("Cookie");
  const session = await sessionStorage.getSession(cookie);
  const token = session.get("token");
  if (token && typeof token === "string") {
    const user = await getUserBySessionToken(token);
    if (user) return user;
    throw redirect("/");
  }

  throw new Response("Unauthorized", { status: 401 });
}

