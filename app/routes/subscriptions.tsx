import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { sessionStorage } from "~/utils/session.server";
import { useEffect, useState } from "react"

import { AppSidebar } from "~/components/app-sidebar"
import { SiteHeader } from "~/components/site-header"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { Button } from "~/components/ui/button"

import { requireUser } from "~/utils/requireUser";
import { db } from "~/utils/db.server";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { toast } from "react-hot-toast";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const cookie = request.headers.get("Cookie");
  const session = await sessionStorage.getSession(cookie);
  const token = session.get("token");

  const stripeSubsriptions = await db.subscription.findMany({
    where: { userId: user.id, status: 'paid' },
    orderBy: { createdAt: "desc" },
    include: {
      plan: {
        include:{
          permissions: true,
        }
      },
    },
  });

  const subscriptions = stripeSubsriptions.map((sub) => ({
    id: sub.id,
    userId: sub.userId,
    planName: sub.plan?.title ?? "Plan",
    priceId: sub.planId,
    status: sub.status,
    tokens: sub.plan?.tokens ?? 0,
    availableTokens: sub.remainingTokens ?? 0,
    interval: sub.plan?.interval ?? "month",
    currency: sub.plan?.currency ?? "usd",
    amount: sub.plan?.amountCents ?? 0,
    nextPayment: sub.currentPeriodEnd?.toISOString(),
    lastPayment: sub.createdAt?.toISOString(),
    permissions: sub.plan?.permissions,
    maxProductUnitsPerMonth: sub.plan?.maxProductUnitsPerMonth,
    remainingProductUnits: sub.remainingProductUnits
  }));

  return {
    user: {
      ...user,
      stripeSubsriptions: subscriptions,
    },
    token,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get("Cookie");
  const session = await sessionStorage.getSession(cookie);
  const token = session.get("token");

  if (token) {
    await db.session.delete({ where: { token } });
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}



type PriceType = {
    id: string;
    title: string;
    description: string;
    amount: number;
    currency: string;
    interval?: string;
    tokens: number;
    stripePriceId: string;
    maxProductUnitsPerMonth: number
  };
  
  type SubscriptionType = {
    id: string;
    userId: string;
    planName: string;
    priceId: string;
    status: string;
    tokens: number;
    availableTokens: number;
    interval: string;
    currency: string;
    amount: number;
    nextPayment: string;
    lastPayment: string;
    permissions: object[];
    maxProductUnitsPerMonth: number;
  };
  
  type UserType = {
    id: string;
    email: string;
    stripeSubsriptions: SubscriptionType[];
  };
  
  type Props = {
    user: UserType;
  };

  function SubscriptionBlock({ user }: Props) {
    const [subscriptionPrices, setSubscriptionPrices] = useState<PriceType[]>([]);
    const [oneTimePrices, setOneTimePrices] = useState<PriceType[]>([]);
  
    const fetchPrices = async () => {
      try {
        const subForm = new FormData();
        subForm.append("action", "get-subscription-plans-local");
        const subRes = await fetch("/api/stripe", { method: "POST", body: subForm });
        const subData = await subRes.json();
        setSubscriptionPrices(subData);

      } catch (err) {
        toast.error("Failed to load pricing");
      }
    };
  
    const handleCheckout = async (priceId: string, mode: "subscription" | "payment") => {
      const formData = new FormData();
      formData.append("action", "create-checkout");
      formData.append("priceId", priceId);
      formData.append("userEmail", user.email);
      formData.append("userId", user.id);
      formData.append("mode", mode);
  
      const res = await fetch("/api/stripe", { method: "POST", body: formData });
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        toast.error("Checkout failed");
      }
    };
  
    useEffect(() => {
      fetchPrices();
    }, []);
  
    const PricingCard = ({ plan, type, disabled }: {plan: PriceType; type: "subscription" | "payment", disabled: boolean }) => {
      
      return (
        <Card className="w-72">
          <CardHeader>
            <CardTitle>{plan.title}</CardTitle>
              { plan.amountCents == 0 && (
                <div className="text-2xl font-bold">
                Free
              </div>
              ) }
            
              { plan.amountCents > 0 && (
                <div className="text-2xl font-bold">
                  {plan.amountCents / 100} {plan.currency}
                  {plan.interval && <span className="text-sm"> / {plan.interval}</span>}
                </div>
              ) }
              
            
            <div className="text-muted-foreground text-sm">Products: {plan.maxProductUnitsPerMonth}</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.description && (
              <p className="text-sm whitespace-pre-line">{plan.description}</p>
            )}
            <div className="text-sm">
              {plan?.permissions?.map(permission =>{
                if(permission.key == 'settings:fields:true'){
                  return (<div key={plan.id + permission.key}>{'Custom Automated Product Listings'}</div>);
                }else if(permission.key == 'language:change:true'){
                  return (<div key={plan.id + permission.key}>{'Multi-Language Generation'}</div>);
                }else if(permission.key == 'generation:seo:true'){
                  return (<div key={plan.id + permission.key}>{'SEO Generation'}</div>);
                }else{
                  // return (<div>{permission.key}</div>);
                }
              })}
            </div>
            <Button
              className="w-full"
              disabled={plan.subscriptions.length > 0 || disabled}
              onClick={() => handleCheckout(plan.stripePriceId, type)}
            >
              {type === "subscription" ? "Select Plan" : "Buy"}
            </Button>
          </CardContent>
        </Card>
      );
    };
  
    const ActiveSubscription = ({ sub, disabled }: { sub: SubscriptionType, disabled: boolean }) => {

      const handleCancel = async () => {
        const formData = new FormData();
        formData.append("action", "cancel-subscription");
        formData.append("subscriptionId", sub.id);
  
        const res = await fetch("/api/stripe", { method: "POST", body: formData });
        const data = await res.json();
  
        if (data.success) {
          toast.success("Subscription canceled");
          window.location.reload();
        } else {
          toast.error("Failed to cancel subscription");
        }
      };

      return (
        <Card className="w-full" >
          <CardHeader>
            <CardTitle>{sub.planName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
<div className="flex gap-100 justify-between items-center">
            <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
               
                { sub.amount > 0 && ((sub.amount / 100) + ' ' + sub.currency + ' / ' +sub.interval) }
                { sub.amount == 0 && ('Free') }
              </span>
              <Badge variant="outline" className="text-green-600 border-green-500">
                {sub.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Available Products:  
              {sub.remainingProductUnits > 0 && ( ' ' + sub.remainingProductUnits)}  
              {(sub.remainingProductUnits > 0 && sub.maxProductUnitsPerMonth > 0 ) && ( ' / ' )}  
              {sub.maxProductUnitsPerMonth > 0 && ( ' ' + sub.maxProductUnitsPerMonth)}
            </div>
            { (sub.lastPayment && sub.nextPayment) && (
              <div className="text-sm text-muted-foreground">
               Last payment: {new Date(sub.lastPayment).toLocaleDateString()} • Next: {new Date(sub.nextPayment).toLocaleDateString()}
              </div>
            ) }
            
            <div className="pt-4">
              {!disabled && (
                <Button variant="destructive" onClick={handleCancel}>
                  Cancel Subscription
                </Button>
              )}
              
            </div>
            </div>
            <div className="text-sm">
              {sub.permissions.map(permission =>{
                if(Boolean(permission.key)){
                if(permission.key == 'settings:fields:true'){
                  return (<div key={sub.id + permission.key}>{'Custom Automated Product Listings'}</div>);
                }else if(permission.key == 'language:change:true'){
                  return (<div key={sub.id + permission.key}>{'Multi-Language Generation'}</div>);
                }else if(permission.key == 'generation:seo:true'){
                  return (<div key={sub.id + permission.key}>{'SEO Generation'}</div>);
                }else{
                 // return (<div>{permission.key}</div>);
                }
              }
              })}
            </div>
            </div>

          </CardContent>
        </Card>
      );
    };

     return (
      <div className="space-y-10">
        {user.stripeSubsriptions.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Active Subscription</h2>
            <div className="space-y-5"> 
            {user.stripeSubsriptions.map((sub) => (
              <ActiveSubscription key={sub.id} sub={sub} disabled={false} />
            ))}
            </div>
          </div>
        )}

        {user.stripeSubsriptions.length == 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Active Subscription</h2>
            <div className="space-y-5"> 
            {subscriptionPrices.map((sub) => {
             
              if(sub.amountCents == 0){
                sub.amount = sub.amountCents;
                sub.status = 'active';
                return (
                  <ActiveSubscription key={sub.id} sub={sub} disabled={true} />
                )
              }
            } )}
            </div>
          </div>
        )}
  
        {subscriptionPrices.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Subscriptions</h2>
            <div className="flex flex-wrap gap-6">
              {subscriptionPrices.map((plan) => (
                <PricingCard key={plan.id} plan={plan} type="subscription" disabled={user.stripeSubsriptions.length > 0 || plan.amount == 0 } />
              ))}
            </div>
          </div>
        )}
  
        {/* <div>
          <h2 className="text-xl font-semibold mb-4">One-time purchase</h2>
          <div className="flex flex-wrap gap-6">
            {oneTimePrices.map((plan) => (
              <PricingCard key={plan.id} plan={plan} type="payment" />
            ))}
          </div>
        </div> */}
      </div>
    );
  }


export default function SubscriptionsPage() {

    type LoaderData = {
        user: UserType & { avatar: string; avatarf: string };
        token: string;
    };
    const data = useLoaderData<LoaderData>();
    data.user.avatarf = '..';


  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar user={data.user} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
            <div >
                <SubscriptionBlock user={data.user}/>
            </div>

              
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}