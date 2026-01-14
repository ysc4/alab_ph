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
import { formatDate, getISOWeek } from "../utils/dateFormatter";
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
  rmse: number;
  mae: number;
  rsquared: number;
  absError1Day: number;
  absError2Day: number;
}

interface PotentialEffects {
  risk_level: string;
  health_risk: string;
  daily_activities: string;
  infrastructure_stress: string;
  environmental_stress: string;
}

interface RecommendedInterventions {
  risk_level: string;
  public_health: string;
  act_management: string;
  resource_readiness: string;
  comm_management: string;
}


const API_BASE_URL = "http://localhost:4001/api";

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
  const [potentialEffects, setPotentialEffects] = useState<PotentialEffects | null>(null);
  const [recommended, setRecommended] = useState<RecommendedInterventions | null>(null);

  const [loading, setLoading] = useState(true);

  // Fetch station info
  useEffect(() => {
    const fetchStationInfo = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/station/${selectedStationId}/info?date=${selectedDate}`
        );
        if (!response.ok) throw new Error("Failed to fetch station info");
        const data = await response.json();
        setStationInfo(data);
      } catch (error) {
        console.error("Error fetching station info:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStationInfo();
  }, [selectedStationId, selectedDate]);

  // Fetch forecasts
  useEffect(() => {
    const fetchForecasts = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/station/${selectedStationId}/forecasts?date=${selectedDate}`
        );
        if (!response.ok) throw new Error("Failed to fetch forecasts");
        const data = await response.json();
        setForecasts(data);
      } catch (error) {
        console.error("Error fetching forecasts:", error);
      }
    };

    fetchForecasts();
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


  // Fetch model metrics
  useEffect(() => {
    const fetchModelMetrics = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/station/${selectedStationId}/metrics?date=${selectedDate}`
        );
        if (!response.ok) throw new Error("Failed to fetch model metrics");
        const data = await response.json();
        setModelMetrics(data);
      } catch (error) {
        console.error("Error fetching model metrics:", error);
      }
    };

    fetchModelMetrics();
  }, [selectedStationId, selectedDate]);

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

  if (loading) return <div>Loading station data...</div>;
  if (!stationInfo) return <div>No station data available</div>;

  const heatIndexTrendData = trendData;

  const formatTempChange = (tempChange: number) => {
    if (!tempChange || tempChange === 0) return "N/A";
    const sign = tempChange >= 0 ? "+" : "-";
    return `${sign}${Math.abs(tempChange).toFixed(2)}°C`;
  };

  return (
    <div className="w-full h-screen py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { 
            title: "Observed Heat Index", 
            value: stationInfo.currentData.observedTemp ? `${stationInfo.currentData.observedTemp}°C` : "N/A", 
            sub: stationInfo.currentData.riskLevel || "N/A" 
          },
          { 
            title: "Heat Index Change", 
            value: formatTempChange(stationInfo.currentData.tempChange), 
            sub: "vs. yesterday" 
          },
          { 
            title: "Station Risk Rank", 
            value: stationInfo.currentData.rank ? `#${stationInfo.currentData.rank}/23` : "N/A", 
            sub: `stations in Luzon` 
          }].map((item) => (
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
                    { label: "RMSE", value: modelMetrics?.rmse || 0 },
                    { label: "MAE", value: modelMetrics?.mae || 0 },
                    { label: "R²", value: modelMetrics?.rsquared || 0 },
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
        {forecasts.map((forecast, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm p-6 text-center"
          >
            <div className="text-2xl font-semibold">
              {index === 0 ? "Tomorrow" : "Day After Tomorrow"}
            </div>
            <div className="text-sm text-gray-500">
              {formatDate(forecast.date)}
            </div>
            <div className="text-6xl font-bold text-primary mt-3">
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
            {heatIndexTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={heatIndexTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
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
              <LineChart data={forecastErrorData}>
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
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-gray-500">No data available for the selected period</p>
            </div>
          )}
        </div>

        {/* TABLES */}
        {[
          {
            title: "Heat Index Potential Effects",
            data: potentialEffects,
            items: [
              {
                icon: Heart,
                title: "Health Risk",
                value: potentialEffects?.health_risk,
              },
              {
                icon: Motorbike,
                title: "Daily Activities",
                value: potentialEffects?.daily_activities,
              },
              {
                icon: Building,
                title: "Infrastructure Stress",
                value: potentialEffects?.infrastructure_stress,
              },
              {
                icon: Sprout,
                title: "Environmental Stress",
                value: potentialEffects?.environmental_stress,
              },
            ],
          },
          {
            title: "Recommended Interventions",
            data: recommended,
            items: [
              {
                icon: ShieldCheck,
                title: "Public Health & Safety",
                value: recommended?.public_health,
              },
              {
                icon: CalendarDays,
                title: "Activity & Schedule Management",
                value: recommended?.act_management,
              },
              {
                icon: Landmark,
                title: "Infrastructure & Resource Readiness",
                value: recommended?.resource_readiness,
              },
              {
                icon: Megaphone,
                title: "Information & Communication Management",
                value: recommended?.comm_management,
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

            {section.data?.risk_level && (
              <p className="text-sm italic mb-4">
                Risk Level: {section.data.risk_level}
              </p>
            )}

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