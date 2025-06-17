// api.settings.ts — Remix API route for loader & action
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/utils/db.server";
import {
  saveGenerationRules,
  saveDefaultDescriptionSettings,
  saveLocaleSettings,
  saveConditions,
  saveDescriptions,
  getSettingsPayload,
  getConditions,
  getDescriptions
} from "~/utils/settings.server";
import { requireUser } from "~/utils/requireUser";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const [settings, conditions_gpt, description_Gen] = await Promise.all([
    getSettingsPayload(user.id),
    getConditions(user.id),
    getDescriptions(user.id),
  ]);

  return new Response(JSON.stringify({ settings, conditions_gpt, description_Gen }), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  switch (actionType) {
    case "update-generation-rules": {
      const data = JSON.parse(formData.get("settings-gen-rules") as string);
      const updated = await saveGenerationRules(user.id, data);
      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" }
      });
    }
    case "update-description-def": {
      const data = JSON.parse(formData.get("settings-desc") as string);
      const updated = await saveDefaultDescriptionSettings(user.id, data);
      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" }
      });
    }
    case "update-language": {
      const locale = formData.get("locale")?.toString() || "";
      const localeDefault = formData.get("localeDefault") === "true";
      const updated = await saveLocaleSettings(user.id, { locale, localeDefault });
      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" }
      });
    }
    case "update-conditions-gpt": {
      const conditions: any[] = [];
      formData.forEach((value, key) => {
        if (key === "condition" && typeof value === "string") {
          conditions.push(JSON.parse(value));
        }
      });
      const updated = await saveConditions(user.id, conditions);
      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" }
      });
    }
    case "update-descriptions-gen": {
      const descriptions: any[] = [];
      formData.forEach((value, key) => {
        if (key === "description" && typeof value === "string") {
          descriptions.push(JSON.parse(value));
        }
      });
      const updated = await saveDescriptions(user.id, descriptions);
      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" }
      });
    }
    default:
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
  }
}
