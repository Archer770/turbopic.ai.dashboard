import Stripe from "stripe";
import { db } from "~/utils/db.server";

export const stripe = new Stripe('sk_test_51REXuEGoyBwUCT4uOtS4QaU9F6yj3IKtzDTYPaeDUoCSh30EuP6cyLaWgERUDwwHoVXgG0MtdqmWczc98RyOEjnm005xh97aVM');

export const getStripePrices = async ({ type }: { type: "one_time" | "recurring" }) => {
  const prices = await stripe.prices.list({
    active: true,
    product: process.env.STRIPE_PRODUCT_ID,
    limit: 100,
    type,
  });

  return prices.data;
};

export const getStripeOneTimePricesLocal = async ({ visible }: { visible?: boolean }) => {
  return db.oneTimeProduct.findMany({
    where: visible !== undefined ? { visible } : {},
    
  });
};

export const getStripeSubscriptionPricesLocal = async ({ visible, userId }: { visible?: boolean, userId: string }) => {
  return db.subscriptionPlan.findMany({
    where: visible !== undefined ? { visible } : {},
    include: {
      permissions: true,
      subscriptions: {
        where:{
          userId: userId,
          status: { in: ["active", "trialing", "paid"] }
        }
      }
    }
  });
};

export const updateStripeOneTimePrices = async () => {
  const prices = await getStripePrices({ type: "one_time" });

  for (const price of prices) {
    try {
      await db.oneTimeProduct.upsert({
        where: {
          stripePriceId: price.id,
        },
        update: {
        amountCents: price.unit_amount!,
          currency: price.currency,
          tokens: price?.metadata?.tokens ? Number(price.metadata.tokens) : 0,
        },
        create: {
          stripePriceId: price.id,
          stripeProductId: typeof price.product === 'string' ? price.product : price.product.id,
          amountCents: price.unit_amount!,
          currency: price.currency,
          tokens: price?.metadata?.tokens ? Number(price.metadata.tokens) : 0
        },
      });
    } catch (error) {
      console.error("Error syncing one-time price:", error);
    }
  }
};

export const updateStripeSubscriptionPrices = async () => {
  const prices = await getStripePrices({ type: "recurring" });
  const currentIds = prices.map(p => p.id);

  for (const price of prices) {
    try {
      await db.subscriptionPlan.upsert({
        where: {
          stripePriceId: price.id,
        },
        update: {
        amountCents: price.unit_amount!,
          currency: price.currency,
          interval: price.recurring?.interval || "month",
          tokens: price?.metadata?.tokens ? Number(price.metadata.tokens) : 0,
          maxProductUnitsPerMonth: price?.metadata?.productUnits ? Number(price.metadata.productUnits) : 0,
          visible: true,
        },
        create: {
          stripePriceId: price.id,
          stripeProductId: typeof price.product === 'string' ? price.product : price.product.id,
          amountCents: price.unit_amount!,
          currency: price.currency,
          interval: price.recurring?.interval || "month",
          tokens: price?.metadata?.tokens ? Number(price.metadata.tokens) : 0,
          maxProductUnitsPerMonth: price?.metadata?.productUnits ? Number(price.metadata.productUnits) : 0,
          visible: true,
        },
      });
    } catch (error) {
      console.error("Error syncing subscription plan:", error);
    }
  }

  await db.subscriptionPlan.updateMany({
    where: {
      stripePriceId: { notIn: currentIds },
    },
    data: {
      visible: false,
    },
  });
};

export const updateStripeOneTimePriceSettings = async (data: {
  id: string;
  title?: string;
  description?: string;
  sortOrder?: number;
  visible?: boolean;
}) => {
  return db.oneTimeProduct.update({
    where: { id: data.id },
    data,
  });
};

export const updateStripeSubscriptionPlanSettings = async (data: {
  id: string;
  title?: string;
  description?: string;
  sortOrder?: number;
  visible?: boolean;
}) => {
  return db.subscriptionPlan.update({
    where: { id: data.id },
    data,
  });
};

export const cancelStripeSubscription = async ({ subscriptionId }: { subscriptionId: string }) => {
  try {

    

    const subscription = await db.subscription.findFirst({
      where:{
        id: subscriptionId
      }
    })

    const deleted = await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    console.log("Canceled subscription:", deleted);
    return { success: true, subscription: deleted };
  } catch (error: any) {
    console.error("Cancel failed:", error);
    return { error: error.message };
  }
};

export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  mode,
}: {
  priceId: string;
  userId: string;
  userEmail: string;
  mode: "payment" | "subscription";
}) {
  const metadata = { userId };

  const stripeData: Stripe.Checkout.SessionCreateParams = {
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.DASHBOARD_API_URL}/subscriptions?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.DASHBOARD_API_URL}/subscriptions`,
    metadata,
  };

  if (mode === "payment") {
    stripeData.payment_intent_data = {
      setup_future_usage: "on_session",
      metadata,
    };
  } else if (mode === "subscription") {
    stripeData.subscription_data = {
      metadata,
    };
  }

  stripeData.customer_email = userEmail;

  const session = await stripe.checkout.sessions.create(stripeData);
  return session.url;
}

export async function getMetadataFromPaymentIntent(paymentIntentId: string) {
  try {
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });

    const session = sessions.data[0];

    if (!session) return [];

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
    });

    return lineItems.data.map((item) => ({
      priceMetadata: item.price?.metadata || {},
      productMetadata: item.price?.product?.metadata || {},
    }));
  } catch (err) {
    console.error("❌ Failed to get metadata from payment intent:", err);
    return [];
  }
}

