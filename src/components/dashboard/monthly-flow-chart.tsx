"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type Point = {
  day: number;
  income: number;
  expense: number;
  incomeCum?: number;
  expenseCum?: number;
};

export function MonthlyFlowChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="day"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
          cursor={{ fill: "hsl(var(--accent))", opacity: 0.3 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" fill="hsl(142 76% 50%)" name="Ingresos" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="hsl(0 84% 60%)" name="Gastos" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}