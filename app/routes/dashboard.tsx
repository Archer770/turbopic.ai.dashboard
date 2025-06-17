import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { sessionStorage } from "~/utils/session.server";
import { useEffect, useState } from "react"

import { AppSidebar } from "~/components/app-sidebar"
import { SiteHeader } from "~/components/site-header"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import LineChartUsageTokens from "~/components/custom/LineChartUsageTokens";
import LineChartPayments from "~/components/custom/LineChartPayments";
import { PieChartTokens } from "~/components/custom/PieChartTokens";

import { MultilineImageDrop, type MultilineValue } from "~/components/MultilineImageDrop"

import { requireUser } from "~/utils/requireUser";
import { db } from "~/utils/db.server";


export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const cookie = request.headers.get("Cookie")
  const session = await sessionStorage.getSession(cookie)
  const token = session.get("token")

  return new Response(JSON.stringify({ user, token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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

export default function DashboardPage() {

  const data = useLoaderData<{ user: { name?: string; email: string; avatar: string; avatarf: string }, token:string }>();
  data.user.avatarf = '..';

  

  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar user={data.user} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <div className="grid auto-rows-min gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-muted/50 p-4" >
                  <LineChartUsageTokens/>
                </div>
                <div className="aspect-video rounded-xl bg-muted/50" >
                  <PieChartTokens/>
                </div>
              </div>
              <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" >
                <LineChartPayments />
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}