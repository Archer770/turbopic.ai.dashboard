import { LoaderFunction } from "@remix-run/node";
import { authenticator } from "~/utils/auth.server";

export const loader: LoaderFunction = async ({ request }) => {
  
  return authenticator.authenticate("google", request);
  
};