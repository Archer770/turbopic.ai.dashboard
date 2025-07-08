import { register } from "~/utils/auth.server";

export async function action({ request }: { request: Request }) {
    try {

        const body = await request.json();

        const { email, password, type, metadata } = body;

        console.log(body);

        return new Response(
            JSON.stringify(body),
        { status: 200, headers: { "Content-Type": "application/json" } }
        );

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

    }catch (error: any) {
    console.error("Integration login error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}



