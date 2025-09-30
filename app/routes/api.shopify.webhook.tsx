import { db } from "~/utils/db.server";
import { addPaymentLog } from "~/utils/analytic.server";
import { requireUser } from "~/utils/requireUser";

type WebhookPayload = {
  topic: string;
  shop: string;   // e.g. my-shop.myshopify.com
  payload: any;
};

// --- helpers ---------------------------------------------------------------

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

async function resolveUserIdByEmailAndShop(
  email?: string | null,
  shop?: string | null,
  shopGid?: string | null
) {
  if (!email) return null;
  const normEmail = String(email).trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normEmail },
    select: { id: true },
  });
  if (!user) return null;

  const normShop = String(shop || "").trim().toLowerCase();
  const integ = await db.integration.findFirst({
    where: {
      type: "shopify",
      userId: user.id,
      OR: [
        { shopDomain: normShop },
        shopGid ? { metadata: { path: ["shopGid"], equals: shopGid } } : undefined,
        { metadata: { path: ["domain"], equals: normShop } },
      ].filter(Boolean) as any,
    },
    select: { id: true },
  });

  return integ ? user.id : null;
}

function pickCurrentPeriodEnd(sub: any): Date | null {
  const raw =
    sub?.current_period_end ??
    sub?.currentPeriodEnd ??
    sub?.updated_at ??           // тільки як фолбек
    sub?.created_at ??
    null;

  if (!raw) return null;
  return typeof raw === "number" ? new Date(raw * 1000) : new Date(String(raw));
}

function getIncomingUserEmail(payload: any): string | null {
  // підтримуємо різні місця/кейси назв:
  return (
    payload?.user_email ??
    payload?.userEmail ??
    payload?.app_subscription?.user_email ??
    payload?.app_subscription?.userEmail ??
    null
  );
}

// --- route action ----------------------------------------------------------

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
        const VERBOSE = process.env.LOG_SUBS_VERBOSE === "true";
        const log = (...a: any[]) => VERBOSE && console.log(...a);
        const warn = (...a: any[]) => console.warn(...a);
        const reqId =
          Math.random().toString(36).slice(2, 8) + "-" + Date.now().toString(36);

        const sub = payload?.app_subscription;
        if (!sub) return new Response("Invalid payload", { status: 400 });

        const subGid: string = sub.admin_graphql_api_id;
        const shopGid: string | undefined = sub.admin_graphql_api_shop_id;

        // 0) якщо підписка вже є — фіксуємо власника з неї (ніколи не міняємо owner при update)
        const existingSub = await db.subscription.findUnique({
          where: { shopifySubscriptionGid: subGid },
          select: {
            id: true,
            userId: true,
            status: true,
            currentPeriodEnd: true,
            remainingTokens: true,
            remainingProductUnits: true,
          },
        });

        // 1) userEmail з payload (апка тепер додає його)
        const userEmail =
          getIncomingUserEmail(payload) ??
          getIncomingUserEmail({ app_subscription: sub });

        // 2) визначаємо userId
        if (existingSub?.userId) {
          if (userId && userId !== existingSub.userId) {
            warn(`[SUBS ${reqId}] incoming userId differs from owner; keeping existing`, {
              subGid,
              existingUserId: existingSub.userId,
              incomingUserId: userId,
            });
          }
          userId = existingSub.userId;
        } else if (!userId) {
          userId =
            (await resolveUserIdByEmailAndShop(userEmail, shop, shopGid)) ??
            (await resolveUserIdByShop(shop, shopGid));

          if (!userId) {
            warn(`[SUBS ${reqId}] cannot resolve userId by email/shop`, {
              subGid,
              shop,
              shopGid,
              userEmail,
            });
            return new Response("User not found for shop/email", { status: 404 });
          }
        }

        log(`[SUBS ${reqId}] incoming`, {
          isService,
          shop,
          subGid,
          shopGid,
          userEmail: userEmail ?? undefined,
          raw: {
            plan_handle: sub.plan_handle,
            name: sub.name ?? sub.plan_name,
            status: sub.status,
            current_period_end: sub.current_period_end ?? sub.currentPeriodEnd,
            price: sub.price,
            currency: sub.currency,
          },
        });

        // --- план: шукаємо по handle АБО title (insensitive)
        const planHandleRaw = sub.plan_handle ?? null;
        const planNameRaw = sub.name ?? sub.plan_name ?? null;

        const planHandle = planHandleRaw ? String(planHandleRaw).trim() : null;
        const planName = planNameRaw ? String(planNameRaw).trim() : null;

        const orConds: any[] = [];
        if (planHandle)
          orConds.push({
            shopifyPlanHandle: { equals: planHandle, mode: "insensitive" },
          });
        if (planName)
          orConds.push({
            title: { equals: planName, mode: "insensitive" },
          });
        if (planHandle)
          orConds.push({
            title: { equals: planHandle, mode: "insensitive" },
          });
        if (planName)
          orConds.push({
            shopifyPlanHandle: { equals: planName, mode: "insensitive" },
          });

        const plan = orConds.length
          ? await db.subscriptionPlan.findFirst({ where: { OR: orConds } })
          : null;

        if (!plan) {
          warn(`[SUBS ${reqId}] plan not found`, {
            incoming_handle: planHandle,
            incoming_name: planName,
            orConds,
          });
          return new Response("Plan not found", { status: 404 });
        }

        log(`[SUBS ${reqId}] plan resolved`, {
          planId: plan.id,
          title: (plan as any).title ?? undefined,
          handle: (plan as any).shopifyPlanHandle ?? undefined,
          tokens: plan.tokens,
          maxUnits: plan.maxProductUnitsPerMonth ?? 0,
        });

        // --- статус/дати
        const amountCents = Math.round(parseFloat(sub.price || "0") * 100);
        const currency = sub.currency || "USD";
        const statusRaw = String(sub.status || "");
        const status = statusRaw.toLowerCase();
        const isCanceled = ["cancelled", "expired"].includes(status);

        const currentPeriodEnd = pickCurrentPeriodEnd(sub);
        if (!currentPeriodEnd) {
          warn(
            `[SUBS ${reqId}] missing current_period_end/currentPeriodEnd/updated_at/created_at`
          );
          return new Response("missing current_period_end", { status: 400 });
        }

        log(`[SUBS ${reqId}] status/dates`, {
          statusRaw,
          statusNorm: status,
          isCanceled,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
        });

        // --- обчислюємо залишки
        let nextRemainingTokens: number;
        let nextRemainingUnits: number;
        let decision = "";

        if (isService) {
          // «бережлива» логіка тільки для service-mode
          if (isCanceled) {
            decision = "service:canceled→zero";
            nextRemainingTokens = 0;
            nextRemainingUnits = 0;
          } else if (!existingSub) {
            decision = "service:first-create→plan-limits";
            nextRemainingTokens = plan.tokens;
            nextRemainingUnits = plan.maxProductUnitsPerMonth ?? 0;
          } else {
            const now = new Date();
            const oldEnd = existingSub.currentPeriodEnd;

            const renewed =
              !!oldEnd &&
              now >= oldEnd &&
              currentPeriodEnd.getTime() !== oldEnd.getTime() &&
              currentPeriodEnd > oldEnd;

            if (renewed) {
              decision = "service:renewed→reset-to-plan";
              nextRemainingTokens = plan.tokens;
              nextRemainingUnits = plan.maxProductUnitsPerMonth ?? 0;
            } else {
              decision = "service:same-period→keep-existing";
              nextRemainingTokens =
                existingSub.remainingTokens ?? plan.tokens;
              nextRemainingUnits =
                existingSub.remainingProductUnits ??
                (plan.maxProductUnitsPerMonth ?? 0);
            }

            log(`[SUBS ${reqId}] period-check`, {
              now: now.toISOString(),
              oldEndIso: oldEnd?.toISOString?.() ?? null,
              newEndIso: currentPeriodEnd.toISOString(),
              renewed,
            });
          }
        } else {
          // вебхук — як раніше
          decision = isCanceled
            ? "webhook:canceled→zero"
            : "webhook:active→plan-limits";
          nextRemainingTokens = isCanceled ? 0 : plan.tokens;
          nextRemainingUnits = isCanceled
            ? 0
            : plan.maxProductUnitsPerMonth ?? 0;
        }

        if (status === "active" && nextRemainingTokens === 0) {
          console.warn(`[SUBS ${reqId}] active→0 tokens`, {
            reason: decision,
            planTokens: plan.tokens,
            existingTokens: existingSub?.remainingTokens,
            subGid,
          });
        }

        log(`[SUBS ${reqId}] decision`, {
          isService,
          decision,
          nextRemainingTokens,
          nextRemainingUnits,
        });

        // --- upsert:
        //    ❗ userId НІКОЛИ не змінюємо в update (фіксуємо власника за існуючою підпискою)
        const updateData: any = {
          planId: plan.id,
          shopifyShopGid: shopGid,
          provider: "SHOPIFY",
          currentPeriodEnd,
          status,
          remainingTokens: nextRemainingTokens,
          remainingProductUnits: nextRemainingUnits,
          // userId — не чіпаємо тут
        };

        const createData: any = {
          planId: plan.id,
          userId: userId!, // створюємо з правильно визначеним власником
          provider: "SHOPIFY",
          shopifySubscriptionGid: subGid,
          shopifyShopGid: shopGid,
          status,
          currentPeriodEnd,
          createdAt: new Date(),
          remainingTokens: nextRemainingTokens,
          remainingProductUnits: nextRemainingUnits,
        };

        log(`[SUBS ${reqId}] upsert →`, {
          updateData: {
            ...updateData,
            currentPeriodEnd: currentPeriodEnd.toISOString(),
          },
          createData: {
            ...createData,
            currentPeriodEnd: currentPeriodEnd.toISOString(),
          },
        });

        const subscription = await db.subscription.upsert({
          where: { shopifySubscriptionGid: subGid },
          update: updateData,
          create: createData,
        });

        log(`[SUBS ${reqId}] after-upsert`, {
          id: subscription.id,
          userId: subscription.userId,
          status: subscription.status,
          end: subscription.currentPeriodEnd?.toISOString?.() ?? null,
          tokens: subscription.remainingTokens,
          units: subscription.remainingProductUnits,
        });

        // аналітика (за бажанням можна логати тільки на create/renewal/cancel)
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
            console.warn("❌ Cannot resolve userId for one-time by shop", {
              shop,
              shopGid,
            });
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
