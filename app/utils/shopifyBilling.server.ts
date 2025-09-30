import { db } from "~/utils/db.server";

export async function applyShopifySubscriptionCycleGrant(params: {
  userId: string;
  subGid: string;            // gid://shopify/AppSubscription/...
  periodEnd: Date;           // кінець білінгового циклу з Shopify
  planTokens: number;        // токени/цикл
  planUnits?: number | null; // одиниці/цикл (якщо треба)
}) {
  const { userId, subGid, periodEnd, planTokens, planUnits } = params;
  const grantKey = `${subGid}:${periodEnd.toISOString()}`;

  // ОДНА спроба «видати» токени за ЦЕЙ periodEnd:
  // - спрацює, якщо lastGrantedPeriodEnd < periodEnd або NULL
  // - одночасно виставляє lastGrantKey (унікальний) — захист від гонок
  const res = await db.subscription.updateMany({
    where: {
      shopifySubscriptionGid: subGid,
      userId,
      OR: [{ lastGrantedPeriodEnd: null }, { lastGrantedPeriodEnd: { lt: periodEnd } }],
    },
    data: {
      remainingTokens: planTokens,
      remainingProductUnits: planUnits ?? 0,
      currentPeriodEnd: periodEnd,
      lastGrantedPeriodEnd: periodEnd,
      lastGrantKey: grantKey,
      updatedAt: new Date(),
    } as any,
  });

  // Якщо 0 — значить або вже нараховано цей цикл, або інший процес випередив.
  return { granted: res.count > 0, grantKey };
}
