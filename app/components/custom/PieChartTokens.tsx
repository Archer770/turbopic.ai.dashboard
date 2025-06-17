"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { Card, CardContent } from "~/components/ui/card";

type TokensData = {
  available: number;
  usage: number;
};

const COLORS = {
  used: "#6366f1",          // фіолетовий
  subscription: "#06b6d4",  // бірюзовий
  oneTime: "#06b6d4",       // такий самий як підписка
};

export function PieChartTokens() {
  const [data, setData] = useState<TokensData>({
    usage: 0,
    available: 0,
  });

  useEffect(() => {
    const fetchTokens = async () => {
      const formData = new FormData();
      formData.append("action", "get-product-usage-distribution");

      const res = await fetch("/api/analytic", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      setData(result);
    };

    fetchTokens();
  }, []);

  const available = data.available;
  const total = available + data.usage;

  const chartData = [
    { name: "Used", value: data.usage, color: COLORS.used },
    { name: "Available", value: total, color: COLORS.subscription },
  ];

  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-center justify-center py-6">
       
        <div className="relative w-[200px] h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={1}
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          {/* Центрований текст */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-muted-foreground">Used / Available</div>
            <div className="text-xs font-bold">
              {data.usage.toLocaleString()} / {available.toLocaleString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
