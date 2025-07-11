import { db } from "~/utils/db.server";
import { addPaymentLog } from "~/utils/analytic.server";
import { requireUser } from "~/utils/requireUser";

type WebhookPayload = {
  topic: string;
  shop: string;
  payload: any;
};

export const action = async ({ request }: { request: Request }) => {
  try {
    const user = await requireUser(request);
    
    const { topic, shop, payload }: WebhookPayload = await request.json();

const userId = user.id;

    console.log("🔔 Shopify Webhook Received:", topic);
    console.log("From shop:", shop);
    console.log("User ID:", userId);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    switch (topic) {
            case "APP_SUBSCRIPTIONS_UPDATE": {
  const sub = payload.app_subscription;

if (!sub) {
  console.warn("❌ payload.app_subscription missing");
  return new Response("Invalid payload", { status: 400 });
}

const subGid = sub.admin_graphql_api_id;
const shopGid = sub.admin_graphql_api_shop_id;
const planHandle = sub.plan_handle;
const amountCents = Math.round(parseFloat(sub.price || "0") * 100);
const currency = sub.currency || "USD";
const status = sub.status.toLowerCase(); // e.g. "cancelled"
const currentPeriodEnd = new Date(sub.updated_at || sub.created_at);

  const isCanceled = ["cancelled", "expired"].includes(status);

  const plan = await db.subscriptionPlan.findFirst({
    where: { shopifyPlanHandle: planHandle },
  });

  console.log(JSON.stringify(plan));

  if (!plan) {
    console.warn("⚠️ No SubscriptionPlan matched for handle:", planHandle);
    return new Response("Plan not found", { status: 404 });
  }

  // Оновлення або створення підписки
  const subscription = await db.subscription.upsert({
    where: { shopifySubscriptionGid: subGid },
    update: {
      planId: plan.id,
      userId,
      shopifyShopGid: shopGid,
      provider: "SHOPIFY",
      currentPeriodEnd,
      status,
      remainingTokens: isCanceled ? 0 : plan.tokens,
      remainingProductUnits: isCanceled ? 0 : plan.maxProductUnitsPerMonth ?? 0,
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
      remainingTokens: isCanceled ? 0 : plan.tokens,
      remainingProductUnits: isCanceled ? 0 : plan.maxProductUnitsPerMonth ?? 0,
    },
  });

  // Запис в аналітику оплати
  await addPaymentLog({
    userId,
    amountCents,
    currency,
    status,
    invoiceId: subGid,
    subscriptionId: subscription.id,
    oneTimeProductId: undefined,
  });

  break;
}



      case "APP_PURCHASES_ONE_TIME_UPDATE": {
        const oneTimeGid = payload.admin_graphql_api_id;
        const shopGid = payload.admin_graphql_api_shop_id;
        const amountCents = Math.round(parseFloat(payload.price) * 100);
        const currency = payload.currency || "USD";
        const status = payload.status.toLowerCase(); // e.g., ACTIVE, CANCELLED

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

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("❌ Shopify Webhook error:", err);
    return new Response("Webhook error", { status: 500 });
  }
};
