import { redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { register, createUserSession } from "~/utils/auth.server";

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
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-4">Create an Account</h1>

      {actionData?.error && (
        <div className="mb-4 text-red-600">{actionData.error}</div>
      )}

      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">Name</label>
          <input
            type="text"
            name="name"
            required
            className="w-full border px-3 py-2 rounded"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            type="email"
            name="email"
            required
            className="w-full border px-3 py-2 rounded"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input
            type="password"
            name="password"
            required
            className="w-full border px-3 py-2 rounded"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
          disabled={navigation.state === "submitting"}
        >
          {navigation.state === "submitting" ? "Registering..." : "Register"}
        </button>
      </Form>

      <div className="mt-4 text-center">
        <a href="/" className="text-blue-600 hover:underline">Already have an account? Sign in</a>
      </div>

      <div className="mt-6">
        <hr className="my-4" />
        <a
          href="/auth/google"
          className="block text-center bg-white border border-gray-300 py-2 px-4 rounded hover:bg-gray-100"
        >
          Continue with Google
        </a>
      </div>
    </div>
  );
}