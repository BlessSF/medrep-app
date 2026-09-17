'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { money } from '../lib/format';

export default function CashoutChart({ data }: { data: { month: string; Cashout: number; Interest: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d3" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip formatter={(v) => money(Number(v))} />
        <Legend />
        <Bar dataKey="Cashout" fill="#1b4332" />
        <Bar dataKey="Interest" fill="#b8860f" />
      </BarChart>
    </ResponsiveContainer>
  );
}
