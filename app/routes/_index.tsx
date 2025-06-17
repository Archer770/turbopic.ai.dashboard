import { LoginForm } from "~/components/login-form"

import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../utils/auth.server";
import { getUserByIntegrationToken } from "../utils/auth.server";
import { createUserSession } from "../utils/auth.server";
import { requireUser } from "~/utils/requireUser";

export async function loader({ request }: LoaderFunctionArgs) {

  try{
  const r_user = await requireUser(request);

  if(r_user.id){
    return await createUserSession(r_user.id, "/dashboard");
  }
  }catch(e){
    console.log(e)
  }

  const url = new URL(request.url);
  let params = url.searchParams;
  let loginToken = params.get("loginToken");
  if(loginToken){
    const user = await getUserByIntegrationToken(loginToken);
    if(user?.id){
      return await createUserSession(user.id, "/dashboard");
    }
  }
  
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  return await login({ request }); 
}

export default function IndexPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm />
      </div>
    </div>
  )
}
