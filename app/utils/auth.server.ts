import { db } from "./db.server";
import bcrypt from "bcryptjs";
import { sessionStorage, authSessionStorage } from "./session.server";
import { redirect } from "@remix-run/node";
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { GoogleStrategy } from "remix-auth-google";
import { v4 as uuidv4 } from "uuid";
import { User } from "@prisma/client";

export const authenticator = new Authenticator(authSessionStorage);

export async function register({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}) {
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("User already exists");

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      provider: "credentials",
    },
  });

  return user;
}

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  session.set("token", token);
  session.set("userId", userId);

  await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

authenticator.use(
  new FormStrategy(async ({ form }) => {
    const email = form.get("email")?.toString();
    const password = form.get("password")?.toString();

    if (!email || !password) throw new Error("Missing credentials");

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.password) throw new Error("Invalid login");

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Invalid login");

    console.log("✅ [auth.server] Login successful for:", user.email);

    return user;
  }),
  "form"
);

authenticator.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/auth/google/callback",
    },
    async ({ profile }) => {
      const email = profile.emails?.[0]?.value;
      if (!email) throw new Error("Google account has no email");

      let user = await db.user.findUnique({ where: { email } });

      if (!user) {
        user = await db.user.create({
          data: {
            email,
            name: profile.displayName,
            provider: "google",
            googleId: profile.id,
          },
        });
      }

      return user;
    }
  ),
  "google"
);


export async function login({ request }: { request: Request }) {
  
  const user = await authenticator.authenticate("form", request) as User;

  return await createUserSession(user.id, "/dashboard");
 
}


export async function logout(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function getUserBySessionToken(token: string): Promise<User | null> {
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  return session?.user ?? null;
}

export async function authenticateBasic(email: string, password: string): Promise<User | null> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.password) return null;

  const isValid = await bcrypt.compare(password, user.password);
  return isValid ? user : null;
}

export async function getUserByIntegrationToken(accessToken: string): Promise<User | null> {
  const integration = await db.integration.findFirst({
    where: { accessToken },
    include: { user: true },
  });

  return integration?.user ?? null;
}