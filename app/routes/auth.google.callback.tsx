import { LoaderFunction } from "@remix-run/node";
import { parse } from "cookie";
import { authenticator, createUserSession } from "~/utils/auth.server";
import type { User } from "@prisma/client";
import { createCookie } from "@remix-run/node";
import db from "~/utils/db.server";

export const oauthStateCookie = createCookie("oauth_state", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 5, 
});

export const loader: LoaderFunction = async ({ request }) => {
  const user = (await authenticator.authenticate("google", request)) as User;

  const cookieHeader = request.headers.get("Cookie");
  const rawCookie = await oauthStateCookie.parse(cookieHeader);
  const { loginToken, shop } = rawCookie ? JSON.parse(rawCookie) : {};;
  console.log(loginToken, shop)
  console.log(rawCookie)

  // Якщо це Shopify login handshake
  if (loginToken && shop) {
    const accessTokenDashboard = crypto.randomUUID();

    // 🛠 записуємо або оновлюємо інтеграцію
    await db.integration.upsert({
      where: {
        userId_shopDomain: {
          userId: user.id,
          shopDomain: shop,
        },
      },
      update: {
        accessToken: accessTokenDashboard,
      },
      create: {
        userId: user.id,
        shopDomain: shop,
        type: "shopify",
        accessToken: accessTokenDashboard,
      },
    });

    // 🔁 відправляємо POST-запит до Shopify App
    await fetch(`${process.env.SHOPIFY_APP_URL}/api/confirm-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        loginToken,
        accessTokenDashboard,
      }),
    });
  }


  return await createUserSession(user.id, "/dashboard");
};
