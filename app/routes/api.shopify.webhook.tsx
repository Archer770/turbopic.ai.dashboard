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
  const VERBOSE = process.env.LOG_SUBS_VERBOSE === "true";
  const log = (...args: any[]) => VERBOSE && console.log(...args);
  const warn = (...args: any[]) => console.warn(...args);

  const mkReqId = () =>
    Math.random().toString(36).slice(2, 8) + "-" + Date.now().toString(36);
  const reqId = mkReqId();

  const sub = payload?.app_subscription;
  if (!sub) return new Response("Invalid payload", { status: 400 });

  const subGid  = sub.admin_graphql_api_id;
  const shopGid = sub.admin_graphql_api_shop_id;

  log(`[SUBS ${reqId}] incoming`, {
    isService,
    shop,
    subGid,
    shopGid,
    raw: {
      plan_handle: sub.plan_handle,
      name: sub.name ?? sub.plan_name,
      status: sub.status,
      current_period_end: sub.current_period_end ?? sub.currentPeriodEnd,
      price: sub.price,
      currency: sub.currency,
    },
  });

  // Якщо сервісний режим — визначаємо userId за магазином
  if (!userId) {
    userId = await resolveUserIdByShop(shop, shopGid);
    if (!userId) {
      warn(`[SUBS ${reqId}] resolveUserId failed`, { shop, shopGid });
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
    warn(`[SUBS ${reqId}] plan not found`, { incoming_handle: planHandle, incoming_name: planName, orConds });
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
  const currency    = sub.currency || "USD";
  const statusRaw   = String(sub.status || "");
  const status      = statusRaw.toLowerCase();
  const isCanceled  = ["cancelled", "expired"].includes(status);

  // Пріоритет: current_period_end / currentPeriodEnd; updated_at/created_at — лише як фолбек
  const rawEnd =
    sub.current_period_end ??
    sub.currentPeriodEnd ??
    sub.updated_at ??
    sub.created_at ?? null;

  if (!rawEnd) {
    warn(`[SUBS ${reqId}] missing current_period_end/currentPeriodEnd/updated_at/created_at`);
    return new Response("missing current_period_end", { status: 400 });
  }

  const currentPeriodEnd =
    typeof rawEnd === "number" ? new Date(rawEnd * 1000) : new Date(String(rawEnd));

  log(`[SUBS ${reqId}] status/dates`, {
    statusRaw,
    statusNorm: status,
    isCanceled,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
  });

  // --- (лише для service-mode) тягнемо існуючі залишки й вирішуємо, чи «ресетити»
  let nextRemainingTokens: number;
  let nextRemainingUnits: number;
  let decision = "";

  if (isService) {
    const existing = await db.subscription.findUnique({
      where: { shopifySubscriptionGid: subGid },
      select: {
        id: true,
        currentPeriodEnd: true,
        remainingTokens: true,
        remainingProductUnits: true,
        status: true,
      },
    });

    log(`[SUBS ${reqId}] existing`, {
      haveExisting: !!existing,
      existingId: existing?.id,
      oldEnd: existing?.currentPeriodEnd?.toISOString?.() ?? null,
      existingTokens: existing?.remainingTokens,
      existingUnits: existing?.remainingProductUnits,
      existingStatus: existing?.status,
    });

    if (isCanceled) {
      decision = "service:canceled";
      nextRemainingTokens = 0;
      nextRemainingUnits  = 0;
    } else if (!existing) {
      decision = "service:first-create";
      nextRemainingTokens = plan.tokens;
      nextRemainingUnits  = plan.maxProductUnitsPerMonth ?? 0;
    } else {
      const now    = new Date();
      const oldEnd = existing.currentPeriodEnd;

      const renewed =
        !!oldEnd &&
        now >= oldEnd &&
        currentPeriodEnd.getTime() !== oldEnd.getTime() &&
        currentPeriodEnd > oldEnd;

      decision = renewed ? "service:renewed-reset" : "service:same-period-keep";

      if (renewed) {
        nextRemainingTokens = plan.tokens;
        nextRemainingUnits  = plan.maxProductUnitsPerMonth ?? 0;
      } else {
        nextRemainingTokens = (existing.remainingTokens ?? plan.tokens);
        nextRemainingUnits  = (existing.remainingProductUnits ?? (plan.maxProductUnitsPerMonth ?? 0));
      }

      log(`[SUBS ${reqId}] period-check`, {
        now: now.toISOString(),
        oldEndIso: oldEnd?.toISOString?.() ?? null,
        newEndIso: currentPeriodEnd.toISOString(),
        renewed,
      });
    }
  } else {
    // --- НЕ service-mode (звичайний форвард вебхука) — залишаємо стару поведінку
    decision = isCanceled ? "webhook:canceled→zero" : "webhook:active→plan-limits";
    nextRemainingTokens = isCanceled ? 0 : plan.tokens;
    nextRemainingUnits  = isCanceled ? 0 : (plan.maxProductUnitsPerMonth ?? 0);
  }

  if (status === "active" && nextRemainingTokens === 0) {
    // 🔎 Ключовий лог для твоєї проблеми
    warn(`[SUBS ${reqId}] MISMATCH active→0tokens`, {
      decision,
      planTokens: plan.tokens,
      planUnits: plan.maxProductUnitsPerMonth ?? 0,
      note: "Якщо планTokens=0 → джерело нульових токенів саме план",
    });
  }

  log(`[SUBS ${reqId}] decision`, {
    isService,
    decision,
    nextRemainingTokens,
    nextRemainingUnits,
  });

  // --- upsert
  log(`[SUBS ${reqId}] upsert →`, {
    planId: plan.id,
    userId,
    shopGid,
    provider: "SHOPIFY",
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    status,
    remainingTokens: nextRemainingTokens,
    remainingProductUnits: nextRemainingUnits,
  });

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

  log(`[SUBS ${reqId}] after-upsert`, {
    id: subscription.id,
    status: subscription.status,
    end: subscription.currentPeriodEnd?.toISOString?.() ?? null,
    tokens: subscription.remainingTokens,
    units: subscription.remainingProductUnits,
  });

  // аналітика
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
