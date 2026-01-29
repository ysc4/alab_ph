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
import { formatDate, getTrendSeries, getForecastErrorSeries } from "../utils/dateFormatter";
import {
  Heart,
  Motorbike,
  Building,
  Sprout,
  ShieldCheck,
  CalendarDays,
  Landmark,
  Megaphone,
} from "lucide-react";
import React from "react";
import { API_BASE_URL } from "../utils/api";

interface TrendData {
  date: string;
  temp: number | null;
  pagasa_forecasted: number | null;
  model_forecasted: number | null;
}

interface ForecastErrorData {
  day: number;
  t_plus_one: number;
  t_plus_two: number;
}

interface StationInfo {
  station: { id: number; name: string; lat: number; lng: number };
  currentData: {
    observedTemp: number;
    tempChange: number;
    riskLevel: string;
    date: string;
    rank: number | null;
    totalStations: number | null;
  };
}

interface ForecastData {
  label: string;
  date: string;
  temp: number | null;
}

interface ModelMetrics {
  rmse_1day: number;
  mae_1day: number;
  rsquared_1day: number;
  rmse_2day: number;
  mae_2day: number;
  rsquared_2day: number;
  absError1Day: number;
  absError2Day: number;
}

interface ClassificationInfo {
  id: number;
  level: string;
  min_temp: string;
  max_temp: string;
  effects: string;
  interventions: string;
  health_risk: string;
  daily_acts: string;
  infra_stress: string;
  env_stress: string;
  public_health: string;
  act_management: string;
  resource_readiness: string;
  comm_engagement: string;
}

const Station: React.FC<{
  selectedStationId: number;
  selectedDate: string;
  onStationSelect: (id: number) => void;
  onDateSelect: (date: string) => void;
}> = ({ selectedStationId, selectedDate }) => {
  const [heatIndexTrendPeriod, setHeatIndexTrendPeriod] =
    useState<"Week" | "Month">("Week");
  const [forecastErrorPeriod, setForecastErrorPeriod] =
    useState<"Week" | "Month">("Week");
  
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [forecastErrorData, setForecastErrorData] = useState<ForecastErrorData[]>([]);

  // Utility: zero out forecast error after selected date
  // function getForecastErrorSeries(
  //   selectedDate: string,
  //   errorData: ForecastErrorData[]
  // ): ForecastErrorData[] {
  //   const selected = new Date(selectedDate);
  //   selected.setHours(0, 0, 0, 0);
  //   return errorData.map((d) => {
  //     // Try to parse day as date string (YYYY-MM-DD) or as day number
  //     let dDate: Date | null = null;
  //     if (typeof d.day === 'string') {
  //       dDate = new Date(d.day);
  //     } else if (typeof d.day === 'number') {
  //       // Assume same month/year as selectedDate
  //       dDate = new Date(selected);
  //       dDate.setDate(d.day);
  //     }
  //     if (dDate && dDate.getTime() > selected.getTime()) {
  //       return { ...d, t_plus_one: 0, t_plus_two: 0 };
  //     }
  //     return d;
  //   });
  // }
  
  const [classificationInfo, setClassificationInfo] = useState<ClassificationInfo | null>(null);

  const [loading, setLoading] = useState(true);

  // Fetch station summary (consolidated: info + forecasts + metrics)
  useEffect(() => {
    const fetchStationSummary = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/station/${selectedStationId}/summary?date=${selectedDate}`
        );
        if (!response.ok) throw new Error("Failed to fetch station summary");
        const data = await response.json();
        setStationInfo({
          station: data.station,
          currentData: data.currentData
        });
        setForecasts(data.forecasts);
        setModelMetrics(data.metrics);
      } catch (error) {
        console.error("Error fetching station summary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStationSummary();
  }, [selectedStationId, selectedDate]);

  // Fetch trend data
  useEffect(() => {
    setTrendData([]); // Reset before fetching
    
    const fetchTrendData = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/station/${selectedStationId}/trend?date=${selectedDate}&range=${heatIndexTrendPeriod}`
        );
        if (!response.ok) throw new Error("Failed to fetch trend data");
        const data = await response.json();
        setTrendData(data);
      } catch (error) {
        console.error("Error fetching trend data:", error);
        setTrendData([]); // Reset on error too
      }
    };

    fetchTrendData();
  }, [selectedStationId, selectedDate, heatIndexTrendPeriod]);

  // Fetch forecast error data
  useEffect(() => {
    const fetchForecastErrorData = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/station/${selectedStationId}/forecast-error?range=${forecastErrorPeriod}&date=${selectedDate}`
        );
        if (!response.ok) throw new Error("Failed to fetch forecast error data");
        const data = await response.json();
        setForecastErrorData(data);
      } catch (error) {
        console.error("Error fetching forecast error data:", error);
      }
    };

    fetchForecastErrorData();
  }, [selectedStationId, selectedDate, forecastErrorPeriod]);

  // Fetch classification info based on station's risk level
  useEffect(() => {
    const fetchClassificationInfo = async () => {
      if (!stationInfo?.currentData?.riskLevel || stationInfo.currentData.riskLevel === 'N/A') {
        setClassificationInfo(null);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/classification-info/${encodeURIComponent(stationInfo.currentData.riskLevel)}`
        );
        if (!response.ok) throw new Error("Failed to fetch classification info");
        const data = await response.json();
        setClassificationInfo(data);
      } catch (error) {
        console.error("Error fetching classification info:", error);
        setClassificationInfo(null);
      }
    };

    fetchClassificationInfo();
  }, [stationInfo?.currentData?.riskLevel]);

  if (loading) return <div>Loading station data...</div>;

  // Provide default values if no station data is available
  const safeStationInfo: StationInfo = stationInfo || {
    station: { id: selectedStationId, name: "N/A", lat: 0, lng: 0 },
    currentData: {
      observedTemp: 0,
      tempChange: 0,
      riskLevel: "N/A",
      date: selectedDate,
      rank: null,
      totalStations: null,
    },
  };
  const safeForecasts: ForecastData[] = forecasts.length > 0 ? forecasts : [
    { label: "Tomorrow", date: selectedDate, temp: null },
    { label: "Day After Tomorrow", date: selectedDate, temp: null },
  ];
  const safeModelMetrics: ModelMetrics = modelMetrics || {
    rmse_1day: 0,
    mae_1day: 0,
    rsquared_1day: 0,
    rmse_2day: 0,
    mae_2day: 0,
    rsquared_2day: 0,
    absError1Day: 0,
    absError2Day: 0,
  };
  const safeClassificationInfo: ClassificationInfo | null = classificationInfo || null;

  const formatTempChange = (tempChange: number) => {
    if (!tempChange || tempChange === 0) return "N/A";
    const sign = tempChange >= 0 ? "+" : "-";
    return `${sign}${Math.abs(tempChange).toFixed(1)}°C`;
  };

  return (
    <div className="w-full h-screen py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { 
            title: "Observed Heat Index", 
            value: safeStationInfo.currentData.observedTemp ? `${Number(safeStationInfo.currentData.observedTemp).toFixed(1)}°C` : "N/A", 
            sub: safeStationInfo.currentData.riskLevel || "N/A" 
          },
          { 
            title: "Heat Index Change", 
            value: formatTempChange(safeStationInfo.currentData.tempChange), 
            sub: "vs. yesterday" 
          },
          { 
            title: "Station Risk Rank", 
            value: safeStationInfo.currentData.rank ? `#${safeStationInfo.currentData.rank}/23` : "N/A", 
            sub: `stations in Luzon` 
          }].map((item) => (
          <div
            key={item.title}
            className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center text-center"
          >
            <h2 className="text-lg font-semibold text-text-primary">
              {item.title}
            </h2>
            <h1 className="text-[56px] font-bold leading-none mt-2 mb-4 text-primary">
              {item.value}
            </h1>
            <p className="text-sm italic text-text-muted">{item.sub}</p>
          </div>
        ))}

        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
          <h2 className="text-[16px] font-semibold mb-1 text-center">Model Confidence</h2>
          <div className="grid grid-cols-2 gap-8">
            {[
              { 
                label: "t+1", 
                metrics: [
                  { label: "RMSE", value: safeModelMetrics.rmse_1day },
                  { label: "MAE", value: safeModelMetrics.mae_1day },
                  { label: "R²", value: safeModelMetrics.rsquared_1day },
                ]
              },
              { 
                label: "t+2", 
                metrics: [
                  { label: "RMSE", value: safeModelMetrics.rmse_2day },
                  { label: "MAE", value: safeModelMetrics.mae_2day },
                  { label: "R²", value: safeModelMetrics.rsquared_2day },
                ]
              },
            ].map((forecast) => (
              <div key={forecast.label}>
                <h3 className="font-semibold text-text-primary mb-0.5 text-center">{forecast.label}</h3>
                <div className="grid grid-cols-2 gap-y-0.5 text-md">
                  {forecast.metrics.map((metric) => (
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
        {safeForecasts.map((forecast, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm p-6 text-center"
          >
            <div className="text-xl font-semibold">
              {index === 0 ? "Tomorrow" : "Day After Tomorrow"}
            </div>
            <div className="text-sm text-gray-500">
              {formatDate(forecast.date)}
            </div>
            <div className="text-5xl font-bold text-primary mt-3">
              {forecast.temp ? `${Number(forecast.temp).toFixed(1)}°C` : "N/A"}
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
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={getTrendSeries(
                    selectedDate,
                    heatIndexTrendPeriod,
                    trendData,
                    ["temp", "pagasa_forecasted", "model_forecasted"]
                  ).map(d => ({
                    day: new Date(d.date).getDate(),
                    ...d
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"/>
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    stroke="#FF6B6B"
                    name="Actual Heat Index"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="pagasa_forecasted"
                    stroke="#4CAF50"
                    name="PAGASA-Forecasted Heat Index"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="model_forecasted"
                    stroke="#2196F3"
                    name="Model-Forecasted Heat Index"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No data available for the selected period</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 xl:col-span-2">
          <div className="flex justify-between mb-3">
            <h1 className="text-2xl font-extrabold">Absolute Forecast Error</h1>
            <Toggle options={["Week", "Month"]} onSelect={(selected) => setForecastErrorPeriod(selected as "Week" | "Month")} />
          </div>
          {forecastErrorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getForecastErrorSeries(selectedDate, forecastErrorData)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
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
          ) : (
            <div className="flex items-center justify-center h-75">
              <p className="text-gray-500">No data available for the selected period</p>
            </div>
          )}
        </div>

        {/* TABLES */}
        {[
          {
            title: "Heat Index Potential Effects",
            data: classificationInfo,
            items: [
              {
                icon: Heart,
                title: "Health Risk",
                value: classificationInfo?.health_risk,
              },
              {
                icon: Motorbike,
                title: "Daily Activities",
                value: classificationInfo?.daily_acts,
              },
              {
                icon: Building,
                title: "Infrastructure Stress",
                value: classificationInfo?.infra_stress,
              },
              {
                icon: Sprout,
                title: "Environmental Stress",
                value: classificationInfo?.env_stress,
              },
            ],
          },
          {
            title: "Recommended Interventions",
            data: classificationInfo,
            items: [
              {
                icon: ShieldCheck,
                title: "Public Health & Safety",
                value: classificationInfo?.public_health,
              },
              {
                icon: CalendarDays,
                title: "Activity & Schedule Management",
                value: classificationInfo?.act_management,
              },
              {
                icon: Landmark,
                title: "Infrastructure & Resource Readiness",
                value: classificationInfo?.resource_readiness,
              },
              {
                icon: Megaphone,
                title: "Information & Communication Management",
                value: classificationInfo?.comm_engagement,
              },
            ],
          },
        ].map((section) => (
          <div
            key={section.title}
            className="bg-white rounded-xl shadow-sm p-6 xl:col-span-2 xl:row-span-2"
          >
            <h1 className="text-2xl font-extrabold mb-1">
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
                      {item.value || "No data available for this risk level"}
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