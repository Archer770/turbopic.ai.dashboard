import { requireUser } from "~/utils/requireUser";
import { type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { updateStripeOneTimePrices, updateStripeSubscriptionPrices, cancelStripeSubscription, getStripeOneTimePricesLocal,  getStripeSubscriptionPricesLocal, createCheckoutSession } from "~/utils/stripe.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("action");

  const user = await requireUser(request);

  switch (actionType) {
    case "sync-subscriptions": {
      await updateStripeSubscriptionPrices();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    case "sync-onetime": {
      await updateStripeOneTimePrices();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    case "cancel-subscription": {
      const subscriptionId = formData.get("subscriptionId")?.toString();
      if (!subscriptionId) {
        return new Response(JSON.stringify({ error: "Missing subscriptionId" }), { status: 400 });
      }
      const result = await cancelStripeSubscription({ subscriptionId });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    case "get-subscription-plans-local": {
      const result = await getStripeSubscriptionPricesLocal({ visible: true, userId: user.id });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    case "get-onetime-prices-local": {
      const result = await getStripeOneTimePricesLocal({ visible: true });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    case "create-checkout": {
      const priceId = formData.get("priceId")?.toString();
      const userId = user.id;
      const userEmail = user.email;
      const mode = formData.get("mode")?.toString() as "payment" | "subscription";
    
      if (!priceId || !userId || !userEmail || !mode) {
        return new Response(JSON.stringify({ error: "Missing required parameters" }), { status: 400 });
      }
    
      try {
        const url = await createCheckoutSession({
          priceId,
          userId,
          userEmail,
          mode,
        });
    
        return new Response(JSON.stringify({ url }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: any) {
        console.error("Stripe error:", error);
        return new Response(JSON.stringify({ error: error.message || "Failed to create checkout session" }), {
          status: 500,
        });
      }
    }
    default:
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response("Stripe API Endpoint", { status: 200 });
}
