import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import Toggle from "../components/toggle";
import ClassificationSelector from "../components/classification-selector";
import { formatDateWithWeek, getWeekOfMonth } from "../utils/dateFormatter";

// Types
type Station = {
  name: string;
  heatIndex: number;
  riskLevel: "Caution" | "Extreme Caution" | "Danger" | "Extreme Danger";
  trend?: string;
};

interface averageHI {
  day: string;
  observed: number;
  forecasted: number;
}

// Sample Data
const averageHeatIndexData: averageHI[] = Array.from({ length: 31 }, (_, i) => ({
    day: String(i + 1).padStart(2, "0"),
    observed: 37 + Math.random() * 8,
    forecasted: 36 + Math.random() * 8
  }));

const meanForecastErrorData = Array.from({ length: 31 }, (_, i) => ({
  day: i + 1,
  t_plus_one: 1 + Math.random() * 3,
  t_plus_two: 1.5 + Math.random() * 3.5,
}));

const stations: Station[] = [
  { name: "Ambulong, Batangas", heatIndex: 40, riskLevel: "Extreme Caution", trend: "+1.1°C" },
  { name: "Baguio City, Benguet", heatIndex: 42, riskLevel: "Extreme Caution", trend: "-2.1°C" },
  { name: "Baler, Aurora", heatIndex: 41, riskLevel: "Extreme Caution" },
  { name: "Basco, Batanes", heatIndex: 39, riskLevel: "Extreme Caution" },
  { name: "Calapan, Oriental Mindoro", heatIndex: 38, riskLevel: "Extreme Caution" },
  { name: "Clark Airport, Pampanga", heatIndex: 45, riskLevel: "Danger" },
  { name: "Daet, Camarines Norte", heatIndex: 39, riskLevel: "Extreme Caution" },
  { name: "Dagupan City, Pangasinan", heatIndex: 41, riskLevel: "Extreme Caution" },
  { name: "Iba, Zambales", heatIndex: 42, riskLevel: "Extreme Caution" },
  { name: "Infanta, Quezon", heatIndex: 41, riskLevel: "Extreme Caution" },
  { name: "Laoag City, Ilocos Norte", heatIndex: 40, riskLevel: "Extreme Caution", trend: "+1.1°C" },
  { name: "Legazpi City, Albay", heatIndex: 42, riskLevel: "Extreme Caution", trend: "-2.1°C" },
  { name: "NAIA, Pasay City", heatIndex: 41, riskLevel: "Extreme Caution" },
  { name: "Port Area, Manila City", heatIndex: 39, riskLevel: "Extreme Caution" },
  { name: "Puerto Princesa, Palawan", heatIndex: 38, riskLevel: "Extreme Caution" },
  { name: "San Jose, Occidental Mindoro", heatIndex: 45, riskLevel: "Danger" },
  { name: "Sangley Point, Cavite", heatIndex: 39, riskLevel: "Extreme Caution" },
  { name: "Science Garden, Quezon City", heatIndex: 41, riskLevel: "Extreme Caution" },
  { name: "Sinait, Ilocos Sur", heatIndex: 42, riskLevel: "Extreme Caution" },
  { name: "Tanay, Rizal", heatIndex: 41, riskLevel: "Extreme Caution" },
  { name: "Tayabas, Quezon", heatIndex: 41, riskLevel: "Extreme Caution" },
  { name: "Tuguegarao, Cagayan", heatIndex: 41, riskLevel: "Extreme Caution" },
  { name: "Virac, Catanduanes", heatIndex: 41, riskLevel: "Extreme Caution" }
];

const synopticData = [
  { name: "Caution", value: 10, color: "#FFD700" },
  { name: "Extreme Caution", value: 9, color: "#FFA500" },
  { name: "Danger", value: 2, color: "#FF4500" },
  { name: "Extreme Danger", value: 2, color: "#8B0000" },
];

interface HomeProps {
  selectedDate: string;
  onDateSelect?: (date: string) => void;
}

const Home: React.FC<HomeProps> = ({ selectedDate, onDateSelect }) => {
  const [heatIndexPeriod, setHeatIndexPeriod] = useState<"Week" | "Month">("Week");
  const [forecastErrorPeriod, setForecastErrorPeriod] = useState<"Week" | "Month">("Week");
  const [classificationFilter, setClassificationFilter] = useState<string>("");

  const selectedWeek = getWeekOfMonth(selectedDate);

  const getFilteredDataByWeek = (data: any[], week: number) => {
    const daysPerWeek = 7;
    const startDay = (week - 1) * daysPerWeek + 1;
    const endDay = startDay + daysPerWeek - 1;
    return data.filter((item) => {
      const day = typeof item.day === "string" ? parseInt(item.day) : item.day;
      return day >= startDay && day <= endDay;
    });
  };

  const filteredAverageHeatIndexData = 
    heatIndexPeriod === "Week" 
      ? getFilteredDataByWeek(averageHeatIndexData, selectedWeek)
      : averageHeatIndexData.slice(0, 31);
  
  const filteredMeanForecastErrorData = 
    forecastErrorPeriod === "Week" 
      ? getFilteredDataByWeek(meanForecastErrorData, selectedWeek)
      : meanForecastErrorData.slice(0, 31);

  const filteredStations = classificationFilter
    ? stations.filter((station) => station.riskLevel.toLowerCase() === classificationFilter.toLowerCase().replace("-", " "))
    : stations;

  const getWeekForDay = (day: number | string): number => {
    const dayNum = typeof day === "string" ? parseInt(day) : day;
    // Assuming first day of month is a Monday for calculation
    return Math.ceil((dayNum + 0) / 7);
  };

  const formatDayWithWeek = (day: number | string): string => {
    const dayNum = typeof day === "string" ? parseInt(day) : day;
    const week = getWeekForDay(dayNum);
    return `W${week} ${String(dayNum).padStart(2, "0")}`;
  };

  const cards = [
    {
      title: "Highest Forecasted Heat Index",
      value: "44°C",
      subtext: "Clark Airport, Pampanga",
    },
    {
      title: "Lowest Forecasted Heat Index",
      value: "38°C",
      subtext: "Puerto Princesa, Palawan",
    },
    {
      title: "Average Forecasted Heat Index",
      value: "41°C",
      subtext: "+ 1.3° C vs. yesterday",
    },
    {
      title: "Number of Stations in Danger-Extreme Danger",
      value: "10",
      subtext: "stations in Luzon",
    },
    {
      title: "Most Rapidly Increasing Station (in 24 hrs)",
      value: "+1.2°C",
      subtext: "Dagupan City, Pangasinan",
    }
  ];

  const columns = [
    { key: "name", label: "Station" },
    { key: "heatIndex", label: "Heat Index" },
    { key: "riskLevel", label: "Risk Level" },
    { key: "trend", label: "Trend" },
  ];

  

  return (
    <div className="w-full h-full py-2">
  <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
    {cards.map((card) => (
      <div
        key={card.title}
        className="bg-white rounded-xl shadow-sm p-4 md:p-5 flex flex-col items-center text-center"
      >
        <h2 className="text-xl font-medium text-text-primary mb-0.5 leading-tight">
          {card.title}
        </h2>

        <h1 className="text-[40px] md:text-[64px] font-bold leading-none mt-2 mb-4 text-primary">
          {card.value}
        </h1>

        <p className="text-[16px] italic text-text-muted">
          {card.subtext}
        </p>
      </div>
    ))}
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <div className="grid gap-6">
      <div className="p-6 bg-white rounded-xl shadow flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-extrabold">Nationwide Heat Index</h2>
          <Toggle options={["Week", "Month"]} onSelect={(selected) => setHeatIndexPeriod(selected as "Week" | "Month")} />
        </div>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredAverageHeatIndexData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
              type="monotone"
              dataKey="observed"
              stroke="#1666BA"
              name="Observed"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-6 bg-white rounded-xl shadow flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-extrabold">Absolute Forecast Error</h2>
          <Toggle options={["Week", "Month"]} onSelect={(selected) => setForecastErrorPeriod(selected as "Week" | "Month")} />
        </div>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredMeanForecastErrorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="t_plus_one" stroke="#1E40AF" name="Error (tomorrow)" />
              <Line type="monotone" dataKey="t_plus_two" stroke="#7AB3EF" name="Error (day after tomorrow)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    {/* Right Column */}
    <div className="grid gap-6">
      <div className="p-6 bg-white rounded-xl shadow flex flex-col h-full min-h-160">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-extrabold">Stations Overview</h2>
          <ClassificationSelector onSelect={setClassificationFilter} />
        </div>
        <div className="flex-1 overflow-y-auto max-h-140">
        <table className="w-full text-left border border-[#B8BBC2] border-collapse rounded-xl">
          <thead className="bg-white">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="p-2 border text-center">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStations.map((station) => (
              <tr key={station.name}>
                {columns.map((col) => {
                  let value = station[col.key as keyof Station];

                  let riskStyle = {};
                  if (col.key === "riskLevel") {
                    switch (station.riskLevel) {
                      case "Caution":
                        riskStyle = { color: "#FFC107", fontWeight: "bold" };
                        break;
                      case "Extreme Caution":
                        riskStyle = { color: "#FF9800", fontWeight: "bold" };
                        break;
                      case "Danger":
                        riskStyle = { color: "#F44336", fontWeight: "bold" };
                        break;
                      case "Extreme Danger":
                        riskStyle = { color: "#B71C1C", fontWeight: "bold" };
                        break;
                    }
                  }

                  if (value === undefined) value = "-";

                  if (col.key === "heatIndex") value = `${value}°C`;

                  return (
                    <td key={col.key} className="p-2 border">
                      <span style={riskStyle}>{value}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>


      <div className="p-6 bg-white rounded-xl shadow flex flex-col h-96">
        <h2 className="text-2xl font-extrabold mb-4">Synoptic Stations</h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={synopticData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#1E40AF" name="Number of Stations">
                {synopticData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
      </div>
    </div>
  </div>
</div>

  );
};

export default Home;
