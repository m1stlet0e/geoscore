'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Sparkles } from 'lucide-react';

export interface RadarDataPoint {
  subject: string;
  A: number;
  B: number;
  fullMark: number;
}

export function RadarVisualizer({
  data,
  brandName,
  competitorName = '行业基准',
}: {
  data: RadarDataPoint[];
  brandName: string;
  competitorName?: string;
}) {
  if (!data.length) {
    return (
      <div className="rounded-[2.5rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
        暂无足够数据生成雷达图，请先完成一次扫描或 Gap 分析
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl" />

      <div className="relative z-10 mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-neutral-900">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            AI 推荐维度透视
          </h2>
          <p className="mt-1 text-sm font-medium text-neutral-500">
            {brandName} 与 {competitorName} 在各大 AI 平台的多维特征对比
          </p>
        </div>
      </div>

      <div className="mt-4 h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 'bold' }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name={brandName}
              dataKey="A"
              stroke="#6366f1"
              strokeWidth={3}
              fill="#6366f1"
              fillOpacity={0.4}
            />
            <Radar
              name={competitorName}
              dataKey="B"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="#10b981"
              fillOpacity={0.1}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', fontSize: '14px' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
