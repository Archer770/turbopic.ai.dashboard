import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireUser } from "~/utils/requireUser";
import { getEffectivePermissions } from "~/utils/permissions.server";
export async function action({ request }: ActionFunctionArgs) {
    const user = await requireUser(request);
    const formData = await request.formData();
    const actionType = formData.get("action");

    switch (actionType) {
        case "get-permissions": {

           const permissions = await getEffectivePermissions(user.id)

            return new Response(JSON.stringify(permissions), {
                headers: { "Content-Type": "application/json" }
            });
        }
    }
}