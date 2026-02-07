
import React from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, ResponsiveContainer, AreaChart, 
  Area, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';
import { ChaosAnalysis } from '../types';

interface EntropyChartProps {
  data: ChaosAnalysis | null;
}

const EntropyChart: React.FC<EntropyChartProps> = ({ data }) => {
  if (!data) return null;

  const radarData = data.categories.map(c => ({
    subject: c.name,
    A: c.weight,
    fullMark: 100,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      <div className="glass p-6 rounded-2xl h-[300px]">
        <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-widest">Chaos Distribution</h3>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Chaos"
              dataKey="A"
              stroke="#818cf8"
              fill="#818cf8"
              fillOpacity={0.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass p-6 rounded-2xl h-[300px] flex flex-col justify-center items-center">
        <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-widest text-left w-full">Current Entropy</h3>
        <div className="relative flex items-center justify-center">
          <svg className="w-48 h-48 transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="80"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-slate-800"
            />
            <circle
              cx="96"
              cy="96"
              r="80"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={502.4}
              strokeDashoffset={502.4 - (502.4 * data.entropyScore) / 100}
              strokeLinecap="round"
              className="text-indigo-500 transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-5xl font-extrabold text-white">{data.entropyScore}</span>
            <p className="text-xs text-slate-500 font-bold uppercase mt-1">Units</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntropyChart;
