'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type TrendPoint = { date: string; count: number };
type PlatformPoint = { id: string; name: string; value: number; color: string };

export function CitationTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-neutral-500">
        暂无趋势数据
      </div>
    );
  }
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="citationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
            minTickGap={24}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            allowDecimals={false}
            domain={[0, (dataMax: number) => Math.max(dataMax + 1, 5)]}
            tickCount={6}
            width={32}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }}
            formatter={(value: number) => [`${value} 次`, 'AI 提及']}
            labelFormatter={(v) => `日期: ${v}`}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#6366f1"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#citationGradient)"
            activeDot={{ r: 6, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlatformDistributionChart({ data }: { data: PlatformPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            itemStyle={{ color: '#1f2937', fontWeight: '500' }}
            formatter={(value: number, name: string) => [
              `${value} 次 (${((value / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: '#4b5563', paddingTop: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
