import type { ActionFunctionArgs } from "@remix-run/node";
import { register, createUserSession } from "~/utils/auth.server";
import { RegisterForm } from "~/components/register-form";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email")?.toString().trim() || "";
  const password = formData.get("password")?.toString() || "";
  const name = formData.get("name")?.toString().trim() || "";

  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: "Email and password are required." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const user = await register({ email, password, name });
    return await createUserSession(user.id, "/dashboard");
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <RegisterForm />
      </div>
    </div>
  );
}
