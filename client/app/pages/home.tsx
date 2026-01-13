import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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

const downloadHomeData = async () => {
  try {
    // Fetch all stations with forecast data from the new endpoint
    const response = await fetch("http://localhost:4001/api/home-data");
    if (!response.ok) throw new Error("Failed to fetch home data");
    const allStations = await response.json();

    // Create a temporary container for the table
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.width = "1200px";
    container.style.backgroundColor = "white";
    container.style.padding = "20px";

    // Create table HTML
    let tableHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="text-align: center; margin-bottom: 20px;">Heat Index Report - All Stations</h1>
        <p style="text-align: center; margin-bottom: 30px;">Generated on ${new Date().toLocaleDateString()}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <thead>
            <tr style="background-color: #1E40AF; color: white;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Station</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Current Heat Index</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Tomorrow Forecast</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Day After Tomorrow Forecast</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Risk Level</th>
            </tr>
          </thead>
          <tbody>
    `;

    // Generate table rows from all stations data
    for (const station of allStations) {
      const rowColor = station.temp > 52 ? "#FFE5E5" : station.temp >= 42 ? "#FFF0E5" : station.temp >= 33 ? "#FFFBE5" : "#FFFCE5";
      
      tableHTML += `
        <tr style="background-color: ${rowColor};">
          <td style="border: 1px solid #ddd; padding: 12px;">${station.name}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center;"><strong>${station.temp}°C</strong></td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${station.tomorrowForecast > 0 ? station.tomorrowForecast + '°C' : 'N/A'}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${station.dayAfterTomorrowForecast > 0 ? station.dayAfterTomorrowForecast + '°C' : 'N/A'}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">${station.riskLevel}</td>
        </tr>
      `;
    }

    tableHTML += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
    document.body.appendChild(container);

    // Convert to canvas and then to PDF
    const canvas = await html2canvas(container, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 297; // A4 landscape width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= 210; // A4 landscape height in mm

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= 210;
    }

    pdf.save(`alab-ph-heat-index-report-${new Date().toISOString().split('T')[0]}.pdf`);

    // Clean up
    document.body.removeChild(container);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating PDF. Please try again.");
  }
};

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
    <div className="grid gap-6 pr-6 md:pr-0">
      <div className="p-6 bg-white rounded-xl shadow flex flex-col h-full min-h-160">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-extrabold">Stations Overview</h2>
          <ClassificationSelector onSelect={setClassificationFilter} />
        </div>
        <div className="flex-1 overflow-y-auto max-h-140">
          <div className="border border-[#E5E7EB] rounded-xl">
            <table className="w-full border-collapse bg-white">
              <thead className="sticky top-0 bg-[#F9FAFB] z-10">
                <tr>
                  {columns.map((col, idx) => (
                    <th
                      key={col.key}
                      className={`p-3 text-left text-sm font-semibold text-[#1E1E1E] border-b border-[#E5E7EB] ${idx === columns.length - 1 ? '' : 'border-r border-[#E5E7EB]'}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStations.map((station) => (
                  <tr key={station.name} className="hover:bg-[#F9FAFB]">
                    {columns.map((col, colIdx) => {
                      let value = station[col.key as keyof Station];

                      if (value === undefined) value = "-";
                      if (col.key === "heatIndex") value = `${value}°C`;

                      if (col.key === "riskLevel") {
                        let badgeClass = 'inline-block px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap';
                        switch (station.riskLevel) {
                          case 'Caution':
                          case 'Extreme Caution':
                            badgeClass += ' bg-[#FEF3C7] text-[#D97706]';
                            break;
                          case 'Danger':
                            badgeClass += ' bg-[#FEE2E2] text-[#DC2626]';
                            break;
                          case 'Extreme Danger':
                            badgeClass += ' bg-[#FEE2E2] text-[#B71C1C]';
                            break;
                        }

                        return (
                          <td key={col.key} className={`p-3 text-sm text-[#1F2937] border-b border-[#E5E7EB] ${colIdx === columns.length - 1 ? '' : 'border-r border-[#E5E7EB]'}`}>
                            <span className={badgeClass}>{station.riskLevel}</span>
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} className={`p-3 text-sm text-[#1F2937] border-b border-[#E5E7EB] ${colIdx === columns.length - 1 ? '' : 'border-r border-[#E5E7EB]'}`}>
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

  <button
    onClick={() => downloadHomeData()}
    title="Download dashboard data"
    aria-label="Download dashboard data"
    className="fixed left-2 bottom-6 bg-white rounded-full shadow-lg p-4.5 flex items-center justify-center hover:shadow-xl z-50 md:left-6 lg:left-68.5"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M21 21H3" />
    </svg>
  </button>

</div>

  );
};

export default Home;
