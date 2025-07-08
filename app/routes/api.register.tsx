import { register } from "~/utils/auth.server";
import { db } from "~/utils/db.server";

export async function action({ request }: { request: Request }) {
    try {

        const body = await request.json();

        const { email, password, name, type, metadata, accessToken } = body;

        console.log(body);

        if (!email || !password || !type) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const customer = await db.user.findUnique({ where: { email } });
        if (customer) {
            return new Response(
            JSON.stringify({ error: "Invalid Email" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        const new_customer = await register({
            email: email,
            password: password,
            name: name
        })

        return new Response(
            JSON.stringify({ customer: new_customer }),
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



