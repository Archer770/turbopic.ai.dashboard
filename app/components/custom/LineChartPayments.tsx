"use client";

import { useEffect, useState, useCallback } from "react";
import dayjs from "dayjs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Card, CardContent } from "~/components/ui/card";
import { DateRange } from "react-day-picker";

type Payment = {
  amountCents: number;
  status: string;
  paidAt: string;
};

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

function getDateArray(startDate: Date, endDate: Date): string[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    return dayjs(date).format("D.MM.YYYY");
  });
}

const getLineItems = (
  payments: Payment[],
  startDate: Date,
  endDate: Date
): { key: string; value: number }[] => {
  const DateArray = getDateArray(startDate, endDate);
  const amounts: Record<string, number> = {};

  payments.forEach((item) => {
    if (item.status === "succeeded" || item.status === "paid") {
      const day = dayjs(item.paidAt).format("D.MM.YYYY");
      if (DateArray.includes(day)) {
        if (typeof amounts[day] !== "number") {
          amounts[day] = 0;
        }
        amounts[day] += item.amountCents * 0.01;
      }
    }
  });

  return DateArray.map((date) => ({
    key: date,
    value: amounts[date] || 0,
  }));
};

export default function LineChartPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [preset, setPreset] = useState("last_7_days");

  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>({
    from: dayjs().subtract(7, "day").toDate(),
    to: new Date(),
  });

  const updateRangeByPreset = useCallback(() => {
    const now = new Date();
    const presets: Record<string, DateRange> = {
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
    updateRangeByPreset();
  }, [preset, updateRangeByPreset]);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!selectedRange?.from || !selectedRange?.to) return;

      const formData = new FormData();
      formData.append("action", "get-payments");
      formData.append("firstDay", selectedRange.from.toISOString());
      formData.append("endDay", selectedRange.to.toISOString());

      const res = await fetch("/api/analytic", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setPayments(data.paymentLogs || []);
    };

    fetchPayments();
  }, [selectedRange]);

  const chartData =
    selectedRange?.from && selectedRange?.to
      ? getLineItems(payments, selectedRange.from, selectedRange.to)
      : [];

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                {selectedRange?.from && selectedRange?.to
                  ? `${dayjs(selectedRange.from).format("D.MM.YYYY")} - ${dayjs(
                      selectedRange.to
                    ).format("D.MM.YYYY")}`
                  : "Select dates"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4">
              <div className="flex gap-4">
                <div className="flex flex-col gap-1 pr-4">
                  {LIST_PRESETS.map((presetItem) => (
                    <Button
                      key={presetItem.id}
                      variant={preset === presetItem.id ? "default" : "ghost"}
                      onClick={() => setPreset(presetItem.id)}
                    >
                      {presetItem.title}
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

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="key" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4bc0c0"
                strokeWidth={2}
                name="Payments ($)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
