import { stripe } from "~/utils/stripe.server";
import { db } from "~/utils/db.server";
import { addPaymentLog } from "~/utils/analytic.server";
import type { Stripe } from "stripe";

async function getMetadataFromPaymentIntent(paymentIntentId: string) {
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
    console.error("getMetadataFromPaymentIntent error:", err);
    return [];
  }
}

async function getPriceMetadataFromInvoice(invoice: Stripe.Invoice) {
  try {
    const lineItems = invoice.lines?.data || [];
    const metadataList = [];

    for (const item of lineItems) {
      const priceId = item.pricing?.price_details?.price;
      if (!priceId) continue;
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      metadataList.push({
        priceId: price.id,
        priceMetadata: price.metadata || {},
        productMetadata: (price.product as any)?.metadata || {},
      });
    }
    return metadataList;
  } catch (err) {
    console.error("getPriceMetadataFromInvoice error:", err);
    return [];
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRequestRawBody(request: Request): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request does not have a readable body");
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export const action = async ({ request }: { request: Request }) => {
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("Missing Stripe signature", { status: 400 });
  const rawBody = await getRequestRawBody(request);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("❌ Invalid signature:", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.customer) {
          await db.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer.toString() },
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription?.toString() || invoice.parent?.subscription_details?.subscription;
        const stripeCustomerId = invoice.customer?.toString();
        const metadataList = await getPriceMetadataFromInvoice(invoice);

        

        const amount = invoice.amount_paid;
        const currency = invoice.currency;
        const priceId = metadataList[0]?.priceId;
        const userId = invoice.parent?.subscription_details?.metadata?.userId || metadataList[0]?.priceMetadata?.userId;
        const monthlyTokens = Number(metadataList[0]?.priceMetadata?.tokens || 0);
        const monthlyProductUnits = Number(metadataList[0]?.priceMetadata?.productUnits || 0);
        
        const plan = await db.subscriptionPlan.findFirst({
            where: {
                stripePriceId: priceId
            }
        })

        const planId = plan.id;

        if (userId && subscriptionId) {
          await db.subscription.upsert({
            where: { stripeSubscriptionId: subscriptionId },
            update: {
              status: invoice.status,
              stripeCustomerId,
              planId: planId,
              remainingTokens: monthlyTokens,
              remainingProductUnits: monthlyProductUnits,
              currentPeriodEnd: new Date((invoice.period_end || invoice.created) * 1000),
              userId,
            },
            create: {
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId,
              planId: planId,
              remainingTokens: monthlyTokens,
              remainingProductUnits: monthlyProductUnits,
              status: invoice.status,
              currentPeriodEnd: new Date((invoice.period_end || invoice.created) * 1000),
              createdAt: new Date(),
              userId,
            },
          }).then(console.log);

          await addPaymentLog({
            userId,
            amountCents: amount,
            currency,
            status: invoice.status,
            invoiceId: invoice.id,
            subscriptionId,
            oneTimeProductId: undefined,
          });
        }
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const userId = pi.metadata?.userId;
        const metaList = await getMetadataFromPaymentIntent(pi.id);
        const priceMeta = metaList[0]?.priceMetadata || {};
        const tokensToAdd = Number(priceMeta.tokens || 0);
        const oneTimeProductId = priceMeta.productId || null;

        if (userId && tokensToAdd > 0) {
          const user = await db.user.findUnique({ where: { id: userId } });
          const newTokens = (user?.oneTimeTokens || 0) + tokensToAdd;

          await db.user.update({
            where: { id: userId },
            data: { oneTimeTokens: newTokens },
          });

          await addPaymentLog({
            userId,
            amountCents: pi.amount_received,
            currency: pi.currency,
            status: pi.status,
            invoiceId: pi.id,
            subscriptionId: undefined,
            oneTimeProductId,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const dbSub = await db.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });

        if (dbSub?.userId) {
          await db.user.update({
            where: { id: dbSub.userId },
            data: {
              oneTimeTokens: {
                increment: dbSub.remainingTokens ?? 0,
                
              },
            },
          });

          await db.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: "canceled",
              remainingTokens: 0,
              remainingProductUnits: 0,
            },
          });
        }
        break;
      }

      default:
        console.log("Unhandled Stripe event:", event.type);
    }
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("❌ Error handling webhook:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
