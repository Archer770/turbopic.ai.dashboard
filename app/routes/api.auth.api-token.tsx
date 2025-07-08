import { db } from "~/utils/db.server";
import bcrypt from "bcryptjs";
import { getUserByIntegrationToken } from "~/utils/auth.server";

export async function action({ request }: { request: Request }) {
  try {

    const authHeader = request.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : null;

    if (bearerToken) {
      const user = await getUserByIntegrationToken(bearerToken);

      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const integration = await db.integration.findFirst({
        where: { accessToken: bearerToken },
      });

      return new Response(
        JSON.stringify({
          accessToken: bearerToken,
          type: integration?.type || "unknown",
          shopDomain: integration?.shopDomain || null,
          user,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }


    const body = await request.json();
    const { email, password, type, metadata } = body;

    if (!email || !password || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const accessToken = crypto.randomUUID();

    const integration = await db.integration.upsert({
        where: {
          userId_shopDomain: {
            userId: user.id,
            shopDomain: metadata.shopDomain,
          },
        },
        update: {
          metadata: metadata ?? {},
        },
        create: {
          userId: user.id,
          type,
          accessToken,
          metadata: metadata ?? {},
          shopDomain: metadata.shopDomain,
        },
      });

    return new Response(
      JSON.stringify({
        accessToken: integration.accessToken,
        type: integration.type,
        shopDomain: integration.shopDomain,
        user,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Integration login error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
