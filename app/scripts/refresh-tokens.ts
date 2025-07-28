import { refreshShopifySubscriptionsTokens } from "~/utils/subscriptionUtils";
import { db } from "~/utils/db.server";

(async () => {
  try {
    const result = await refreshShopifySubscriptionsTokens();
    console.log(`✅ Tokens refreshed: ${result.updated} / ${result.total}`);
  } catch (err) {
    console.error("❌ Error refreshing tokens:", err);
  } finally {
    await db.$disconnect();
  }
})();