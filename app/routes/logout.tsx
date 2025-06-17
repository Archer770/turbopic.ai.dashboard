import { type ActionFunction, type LoaderFunction, redirect } from "@remix-run/node";
import { sessionStorage } from "~/utils/session.server";
import { db } from "~/utils/db.server";

async function handleLogout(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const token = session.get("sessionToken");

  if (token) {
    await db.session.deleteMany({ where: { token } });
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export const loader: LoaderFunction = async ({ request }) => {
  return handleLogout(request);
};

export const action: ActionFunction = async ({ request }) => {
  return handleLogout(request);
};