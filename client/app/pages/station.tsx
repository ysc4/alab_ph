import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";
import Toggle from "../components/toggle";
import { formatDate, formatDateShort, getWeekOfMonth } from "../utils/dateFormatter";
import {
  Heart,
  Motorbike,
  Building,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  Landmark,
  Megaphone,
} from "lucide-react";
import React from "react";

interface TrendData {
  date: string;
  temp: number;
}

interface StationData {
  station: { id: number; name: string; lat: number; lng: number };
  currentData: {
    observedTemp: number;
    tempChange: number;
    riskLevel: string;
    date: string;
    rank: number | null;
  };
  forecasts: Array<{ date: string; temp: number | null }>;
  trend: TrendData[];
  modelMetrics: {
    rmse: string;
    mae: string;
    rsquared: string;
    absError1Day: number | null;
    absError2Day: number | null;
  };
}

const Station: React.FC<{
  selectedStationId: number;
  selectedDate: string;
  onStationSelect: (id: number) => void;
  onDateSelect: (date: string) => void;
}> = ({ selectedStationId, selectedDate }) => {
  const [heatIndexTrendPeriod, setHeatIndexTrendPeriod] =
    useState<"Week" | "Month">("Week");
  const [stationData, setStationData] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStationData = async () => {
      try {
        const response = await fetch(
          `http://localhost:4001/api/station/${selectedStationId}?date=${selectedDate}`
        );
        if (!response.ok) throw new Error("Failed to fetch station data");
        const data = await response.json();
        setStationData(data);
      } catch (error) {
        console.error("Error fetching station data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStationData();
  }, [selectedStationId, selectedDate]);

  if (loading) return <div>Loading station data...</div>;
  if (!stationData) return <div>No station data available</div>;

  const selectedWeek = getWeekOfMonth(selectedDate);

  const getFilteredTrendDataByWeek = (data: TrendData[], week: number) => {
    const daysPerWeek = 7;
    const startDay = (week - 1) * daysPerWeek + 1;
    const endDay = startDay + daysPerWeek - 1;

    return data.filter((item) => {
      const day = new Date(item.date).getDate();
      return day >= startDay && day <= endDay;
    });
  };

  const heatIndexTrendData =
    heatIndexTrendPeriod === "Week"
      ? getFilteredTrendDataByWeek(stationData.trend, selectedWeek)
      : stationData.trend;

  const absoluteForecastErrorData = [
    {
      label: "Current",
      t_plus_one: stationData.modelMetrics.absError1Day,
      t_plus_two: stationData.modelMetrics.absError2Day,
    },
  ];

  const formatTempChange = (tempChange: number) => {
    const sign = tempChange >= 0 ? "+" : "-";
    return `${sign}${Math.abs(tempChange).toFixed(2)}°C`;
  };

  return (
    <div className="w-full h-screen py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { title: "Observed Heat Index", value: `${stationData.currentData.observedTemp}°C`, sub: stationData.currentData.riskLevel },
          { title: "Heat Index Change", value: formatTempChange(stationData.currentData.tempChange), sub: "vs. yesterday" },
          { title: "Station Risk Rank", value: stationData.currentData.rank ? `#${stationData.currentData.rank}/23` : "N/A", sub: `stations in Luzon` }].map((item) => (
          <div
            key={item.title}
            className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center text-center"
          >
            <h2 className="text-[24px] font-semibold text-text-primary">
              {item.title}
            </h2>
            <h1 className="text-[70px] font-bold leading-none mt-2 mb-4 text-primary">
              {item.value}
            </h1>
            <p className="text-[16px] italic text-text-muted">{item.sub}</p>
          </div>
        ))}

        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
          <h2 className="text-[24px] font-semibold mb-1 text-center">Model Confidence</h2>
          <div className="grid grid-cols-2 gap-8">
            {["t+1", "t+2"].map((forecast) => (
              <div key={forecast}>
                <h3 className="font-semibold text-text-primary mb-0.5 text-center">{forecast}</h3>
                <div className="grid grid-cols-2 gap-y-0.5 text-md">
                  {[
                    { label: "RMSE", value: stationData.modelMetrics.rmse },
                    { label: "MAE", value: stationData.modelMetrics.mae },
                    { label: "R²", value: stationData.modelMetrics.rsquared },
                  ].map((metric) => (
                    <React.Fragment key={metric.label}>
                      <div className="italic text-text-primary">{metric.label}</div>
                      <div className="font-bold text-primary text-right">{metric.value}</div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 mt-5 mb-5">
        {stationData.forecasts.map((forecast, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm p-6 text-center"
          >
            <div className="text-lg font-semibold">
              {index === 0 ? "Tomorrow" : "Day After Tomorrow"}
            </div>
            <div className="text-sm text-gray-500">
              {formatDate(forecast.date)}
            </div>
            <div className="text-5xl font-bold text-primary mt-3">
              {forecast.temp ? `${forecast.temp}°C` : "N/A"}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl shadow-sm p-6 xl:col-span-2 xl:row-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-extrabold">
             Heat Index Trend
            </h1>
            <Toggle options={["Week", "Month"]} onSelect={(selected) => setHeatIndexTrendPeriod(selected as "Week" | "Month")} />
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart data={heatIndexTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDateShort} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="temp"
                stroke="#FF6B6B"
                name="Actual Heat Index"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

        <div className="bg-white rounded-xl shadow-sm p-6 xl:col-span-2">
          <div className="flex justify-between mb-3">
            <h1 className="text-2xl font-extrabold">Absolute Forecast Error</h1>
            <Toggle
              options={["Week", "Month"]}
              onSelect={(v) =>
                setHeatIndexTrendPeriod(v as "Week" | "Month")
              }
            />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={absoluteForecastErrorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="t_plus_one"
                stroke="#1E40AF"
                name="1-Day Ahead Error"
              />
              <Line
                type="monotone"
                dataKey="t_plus_two"
                stroke="#7AB3EF"
                name="2-Day Ahead Error"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* TABLES */}
        {[
          {
            title: "Heat Index Potential Effects",
            items: [
              { icon: Heart, title: "Health Risk" },
              { icon: Motorbike, title: "Daily Activities" },
              { icon: Building, title: "Infrastructure Stress" },
              { icon: Sparkles, title: "Environmental Stress" },
            ],
          },
          {
            title: "Recommended Interventions",
            items: [
              { icon: ShieldCheck, title: "Health Risk" },
              { icon: CalendarDays, title: "Daily Activities" },
              { icon: Landmark, title: "Infrastructure Stress" },
              { icon: Megaphone, title: "Environmental Stress" },
            ],
          },
        ].map((section) => (
          <div
            key={section.title}
            className="bg-white rounded-xl shadow-sm p-6 xl:col-span-2 xl:row-span-2"
          >
            <h1 className="text-2xl font-extrabold mb-4">
              {section.title}
            </h1>

            <div className="divide-y border-y">
              {section.items.map((item) => (
                <div key={item.title} className="flex gap-4 py-4">
                  <item.icon className="w-8 h-8 text-primary" />
                  <div>
                    <strong className="block text-base">
                      {item.title}
                    </strong>
                    <p className="text-xs text-text-muted">
                      Fatigue possible with prolonged exposure and/or
                      physical activity
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Station;