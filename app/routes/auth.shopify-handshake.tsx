import { LoaderFunction } from "@remix-run/node";
import { authenticator } from "~/utils/auth.server";
import { createCookie } from "@remix-run/node";

export const oauthStateCookie = createCookie("oauth_state", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 5, 
});

export const loader:LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const loginToken = url.searchParams.get("loginToken");
  const shop = url.searchParams.get("shop");


  if (!loginToken || !shop) {
    return new Response("Missing loginToken or shop", { status: 400 });
  }

  const stateData = JSON.stringify({ loginToken, shop });
  const cookie = await oauthStateCookie.serialize(stateData);
 

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/auth/google",
      "Set-Cookie": cookie,
    },
  });

};
