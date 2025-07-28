import type { ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { refreshShopifySubscriptionsTokens } from "~/utils/subscriptionUtils";

export const action: ActionFunction = async () => {
  try {
    await refreshShopifySubscriptionsTokens();

    // Просто підтвердження успішного виконання, без деталей
    return { success: true };
  } catch (error) {
    console.error("❌ Subscription refresh error:", error);
    return { success: false };
  }
};
