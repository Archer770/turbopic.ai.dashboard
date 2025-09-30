import { db } from "~/utils/db.server";
import { addPaymentLog } from "~/utils/analytic.server";
import { requireUser } from "~/utils/requireUser";

type WebhookPayload = {
  topic: string;
  shop: string;   // my-shop.myshopify.com
  payload: any;
};

async function resolveUserIdByShop(shop: string, shopGid?: string) {
  const norm = String(shop || "").trim().toLowerCase();

  const integ = await db.integration.findFirst({
    where: {
      type: "shopify",
      OR: [
        { shopDomain: norm },
        shopGid ? { metadata: { path: ["shopGid"], equals: shopGid } } : undefined,
        { metadata: { path: ["domain"], equals: norm } },
      ].filter(Boolean) as any,
    },
    select: { userId: true },
  });

  return integ?.userId ?? null;
}

export const action = async ({ request }: { request: Request }) => {
  try {
    const auth = request.headers.get("Authorization");
    const isService = auth === `Bearer ${process.env.APP_OR_CRON_TOKEN}`;

    const userCtx = isService ? null : await requireUser(request);

    const { topic, shop, payload }: WebhookPayload = await request.json();

    let userId: string | null = userCtx?.id ?? null;

    console.log("🔔 Shopify Webhook Received:", topic);
    console.log("From shop:", shop);

    switch (topic) {
      case "APP_SUBSCRIPTIONS_UPDATE": {
        const sub = payload?.app_subscription;
        if (!sub) return new Response("Invalid payload", { status: 400 });

        const subGid  = sub.admin_graphql_api_id;
        const shopGid = sub.admin_graphql_api_shop_id;

        // Якщо сервісний режим — визначаємо userId за магазином
        if (!userId) {
          userId = await resolveUserIdByShop(shop, shopGid);
          if (!userId) {
            console.warn("❌ Cannot resolve userId by shop/shopGid", { shop, shopGid });
            return new Response("User not found for shop", { status: 404 });
          }
        }

        // --- план: шукаємо по handle АБО title (insensitive)
        const planHandleRaw = sub.plan_handle ?? null;
        const planNameRaw   = sub.name ?? sub.plan_name ?? null;

        const planHandle = planHandleRaw ? String(planHandleRaw).trim() : null;
        const planName   = planNameRaw   ? String(planNameRaw).trim()   : null;

        const orConds: any[] = [];
        if (planHandle) orConds.push({ shopifyPlanHandle: { equals: planHandle, mode: "insensitive" } });
        if (planName)   orConds.push({ title:             { equals: planName,   mode: "insensitive" } });
        if (planHandle) orConds.push({ title:             { equals: planHandle, mode: "insensitive" } });
        if (planName)   orConds.push({ shopifyPlanHandle: { equals: planName,   mode: "insensitive" } });

        const plan = orConds.length
          ? await db.subscriptionPlan.findFirst({ where: { OR: orConds } })
          : null;

        if (!plan) {
          console.warn("⚠️ No SubscriptionPlan matched", { incoming_handle: planHandle, incoming_name: planName });
          return new Response("Plan not found", { status: 404 });
        }

        // --- статус/дати
        const amountCents = Math.round(parseFloat(sub.price || "0") * 100);
        const currency    = sub.currency || "USD";
        const status      = String(sub.status || "").toLowerCase();
        const isCanceled  = ["cancelled", "expired"].includes(status);

        // Пріоритет: current_period_end / currentPeriodEnd; updated_at/created_at — лише як фолбек
        const rawEnd =
          sub.current_period_end ??
          sub.currentPeriodEnd ??
          sub.updated_at ??
          sub.created_at ?? null;

        if (!rawEnd) {
          console.warn("❌ missing current_period_end/currentPeriodEnd/updated_at/created_at");
          return new Response("missing current_period_end", { status: 400 });
        }

        const currentPeriodEnd =
          typeof rawEnd === "number" ? new Date(rawEnd * 1000) : new Date(String(rawEnd));

        // --- (лише для service-mode) тягнемо існуючі залишки й вирішуємо, чи «ресетити»
        let nextRemainingTokens: number;
        let nextRemainingUnits: number;

        if (isService) {
          const existing = await db.subscription.findUnique({
            where: { shopifySubscriptionGid: subGid },
            select: {
              id: true,
              currentPeriodEnd: true,
              remainingTokens: true,
              remainingProductUnits: true,
            },
          });

          if (isCanceled) {
            nextRemainingTokens = 0;
            nextRemainingUnits  = 0;
          } else if (!existing) {
            // перша поява — стартові значення
            nextRemainingTokens = plan.tokens;
            nextRemainingUnits  = plan.maxProductUnitsPerMonth ?? 0;
          } else {
            const now   = new Date();
            const oldEnd = existing.currentPeriodEnd;

            // вважаємо, що новий білінговий цикл настав, якщо стара дата вже минула й нова дата більша/інша
            const renewed =
              !!oldEnd &&
              now >= oldEnd &&
              currentPeriodEnd.getTime() !== oldEnd.getTime() &&
              currentPeriodEnd > oldEnd;

            if (renewed) {
              nextRemainingTokens = plan.tokens;
              nextRemainingUnits  = plan.maxProductUnitsPerMonth ?? 0;
            } else {
              // ще той самий цикл — залишаємо як було
              nextRemainingTokens = existing.remainingTokens ?? plan.tokens;
              nextRemainingUnits  = existing.remainingProductUnits ?? (plan.maxProductUnitsPerMonth ?? 0);
            }
          }
        } else {
          // --- НЕ service-mode (звичайний форвард вебхука) — залишаємо стару поведінку
          nextRemainingTokens = isCanceled ? 0 : plan.tokens;
          nextRemainingUnits  = isCanceled ? 0 : (plan.maxProductUnitsPerMonth ?? 0);
        }

        console.log( userId, status, nextRemainingTokens, nextRemainingUnits, currentPeriodEnd )

        // --- upsert (базові поля оновлюємо завжди; залишки — відповідно до гілки вище)
        const subscription = await db.subscription.upsert({
          where: { shopifySubscriptionGid: subGid },
          update: {
            planId: plan.id,
            userId,
            shopifyShopGid: shopGid,
            provider: "SHOPIFY",
            currentPeriodEnd,
            status,
            remainingTokens: nextRemainingTokens,
            remainingProductUnits: nextRemainingUnits,
          },
          create: {
            planId: plan.id,
            userId,
            provider: "SHOPIFY",
            shopifySubscriptionGid: subGid,
            shopifyShopGid: shopGid,
            status,
            currentPeriodEnd,
            createdAt: new Date(),
            remainingTokens: nextRemainingTokens,
            remainingProductUnits: nextRemainingUnits,
          },
        });

        // аналітика — як було
        await addPaymentLog({
          userId,
          amountCents,
          currency,
          status,
          invoiceId: subGid,
          subscriptionId: subscription.id,
          oneTimeProductId: undefined,
          provider: "SHOPIFY",
        });

        break;
      }

      case "APP_PURCHASES_ONE_TIME_UPDATE": {
        const oneTimeGid = payload.admin_graphql_api_id;
        const shopGid = payload.admin_graphql_api_shop_id;
        const amountCents = Math.round(parseFloat(payload.price) * 100);
        const currency = payload.currency || "USD";
        const status = String(payload.status || "").toLowerCase();

        if (!userId) {
          const resolved = await resolveUserIdByShop(shop, shopGid);
          if (!resolved) {
            console.warn("❌ Cannot resolve userId for one-time by shop", { shop, shopGid });
            return new Response("User not found for shop", { status: 404 });
          }
          userId = resolved;
        }

        await db.payment.upsert({
          where: { shopifyPurchaseGid: oneTimeGid },
          update: {
            status,
            currency,
            amountCents,
          },
          create: {
            userId,
            provider: "SHOPIFY",
            shopifyPurchaseGid: oneTimeGid,
            shopifyShopGid: shopGid,
            amountCents,
            currency,
            status,
            paidAt: new Date(),
            createdAt: new Date(),
          },
        });

        break;
      }

      default:
        console.log("⚠️ Unhandled topic:", topic);
        break;
    }

    console.log("User ID:", userId);
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("❌ Shopify Webhook error:", err);
    return new Response("Webhook error", { status: 500 });
  }
};
