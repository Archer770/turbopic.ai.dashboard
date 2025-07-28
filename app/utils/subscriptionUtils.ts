import { db } from "~/utils/db.server";
import { differenceInMonths, isAfter } from "date-fns";

export async function refreshShopifySubscriptionsTokens() {
  const now = new Date();

  const subscriptions = await db.subscription.findMany({
    where: {
      provider: "SHOPIFY",
      status: "active",
    },
    include: {
      plan: true,
    },
  });

  let updatedCount = 0;

  for (const sub of subscriptions) {
    if (!sub.currentPeriodEnd || !sub.plan) continue;

    const nextResetDate = new Date(sub.currentPeriodEnd);
    nextResetDate.setMonth(nextResetDate.getMonth() + 1);

    if (isAfter(now, nextResetDate)) {
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodEnd: now,
          remainingTokens: sub.plan.tokens,
          remainingProductUnits: sub.plan.maxProductUnitsPerMonth ?? 0,
        },
      });

      updatedCount++;
    }
  }

  return {
    updated: updatedCount,
    total: subscriptions.length,
  };
}
