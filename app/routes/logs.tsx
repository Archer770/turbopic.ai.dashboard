// File: app/routes/logs.tsx (shadcn UI version)

import { useEffect, useState, useCallback, useMemo } from "react";
import dayjs from "dayjs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "~/components/ui/table";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";

import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { sessionStorage } from "~/utils/session.server";

import { AppSidebar } from "~/components/app-sidebar"
import { SiteHeader } from "~/components/site-header"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import LineChartUsageTokens from "~/components/custom/LineChartUsageTokens";
import LineChartPayments from "~/components/custom/LineChartPayments";

import { requireUser } from "~/utils/requireUser";
import { db } from "~/utils/db.server";

const LIST_PRESETS = [
  { id: "last_7_days", title: "Last 7 days" },
  { id: "last_30_days", title: "Last 30 days" },
  { id: "current_week", title: "Current week" },
  { id: "previous_week", title: "Previous week" },
  { id: "current_month", title: "Current month" },
  { id: "previous_month", title: "Previous month" },
  { id: "current_year", title: "Current year" },
  { id: "previous_year", title: "Previous year" },
];

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireUser(request);
    const cookie = request.headers.get("Cookie")
    const session = await sessionStorage.getSession(cookie)
    const token = session.get("token")
  
    console.log("📦 [dashboard.loader] Loaded user:", user);
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

function Logs() {
  const [logs, setLogs] = useState([]);
  const [preset, setPreset] = useState("last_7_days");
  const [selectedRange, setSelectedRange] = useState({
    from: dayjs().subtract(7, "day").toDate(),
    to: new Date(),
  });

  const updatePreset = useCallback(() => {
    const now = new Date();
    const presets = {
      last_7_days: { from: dayjs(now).subtract(7, "day").toDate(), to: now },
      last_30_days: { from: dayjs(now).subtract(30, "day").toDate(), to: now },
      current_week: { from: dayjs(now).startOf("week").toDate(), to: now },
      previous_week: {
        from: dayjs(now).subtract(1, "week").startOf("week").toDate(),
        to: dayjs(now).subtract(1, "week").endOf("week").toDate(),
      },
      current_month: { from: dayjs(now).startOf("month").toDate(), to: now },
      previous_month: {
        from: dayjs(now).subtract(1, "month").startOf("month").toDate(),
        to: dayjs(now).subtract(1, "month").endOf("month").toDate(),
      },
      current_year: { from: dayjs(now).startOf("year").toDate(), to: now },
      previous_year: {
        from: dayjs(now).subtract(1, "year").startOf("year").toDate(),
        to: dayjs(now).subtract(1, "year").endOf("year").toDate(),
      },
    };

    setSelectedRange(presets[preset]);
  }, [preset]);

  useEffect(() => {
    updatePreset();
  }, [preset, updatePreset]);

  useEffect(() => {
    const fetchLogs = async () => {
      const formData = new FormData();
      formData.append("action", "get-logs");
      formData.append("firstDay", selectedRange.from.toISOString());
      formData.append("endDay", selectedRange.to.toISOString());
      const res = await fetch("api/analytic", { method: "POST", body: formData });
      const data = await res.json();
      setLogs(data);
    };
    fetchLogs();
  }, [selectedRange]);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                {dayjs(selectedRange.from).format("D.MM.YYYY")} - {dayjs(selectedRange.to).format("D.MM.YYYY")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4">
              <div className="flex gap-4">
                <div className="flex flex-col gap-1 pr-4">
                  {LIST_PRESETS.map((p) => (
                    <Button
                      key={p.id}
                      variant={preset === p.id ? "default" : "ghost"}
                      onClick={() => setPreset(p.id)}
                    >
                      {p.title}
                    </Button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={setSelectedRange}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Product ID</TableHead>
              <TableHead>View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const json = JSON.parse(log.jsonValue || '{}');
              return (
                <TableRow key={log.id}>
                  <TableCell>{log.id}</TableCell>
                  <TableCell>{dayjs(log.createdAt).format("D.MM.YYYY HH:mm")}</TableCell>
                  <TableCell><Badge>{log.action}</Badge></TableCell>
                  <TableCell>{log.tokensUsed}</TableCell>
                  <TableCell>{log.productId}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="secondary">View</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogTitle>{`Log #${log.id}`}</DialogTitle>
                        <ScrollArea className="h-40">
                          <p className="text-sm whitespace-pre-wrap break-all">
                            {JSON.stringify(json, null, 2)}
                          </p>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}






export default function LogsPage() {

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
              <Logs/>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}