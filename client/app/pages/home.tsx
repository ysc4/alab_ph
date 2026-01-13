import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Toggle from "../components/toggle";
import ClassificationSelector from "../components/classification-selector";

const API_BASE_URL = "http://localhost:4001/api";

// Types
type Station = {
  name: string;
  heat_index: number;
  risk_level: "Caution" | "Extreme Caution" | "Danger" | "Extreme Danger";
  trend?: string;
};

interface AverageHI {
  day: string;
  observed: number;
}

interface ForecastError {
  day: number;
  t_plus_one: number;
  t_plus_two: number;
}

interface SynopticData {
  name: string;
  value: number;
  color: string;
}

interface SummaryData {
  max: number;
  max_station: string;
  min: number;
  min_station: string;
  avg: number;
  danger_count: number;
  fastest_increasing_station: string;
  fastest_increasing_trend: number;
}

const downloadHomeData = async () => {
  try {
    // Fetch all stations data
    const response = await fetch(`${API_BASE_URL}/stations-table`);
    if (!response.ok) throw new Error(`Failed to fetch home data: ${response.status} ${response.statusText}`);
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
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Risk Level</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">24h Trend</th>
            </tr>
          </thead>
          <tbody>
    `;

    // Generate table rows from all stations data
    for (const station of allStations) {
      const rowColor = station.heat_index >= 54 ? "#FFE5E5" : station.heat_index >= 41 ? "#FFF0E5" : station.heat_index >= 33 ? "#FFFBE5" : "#FFFCE5";
      
      tableHTML += `
        <tr style="background-color: ${rowColor};">
          <td style="border: 1px solid #ddd; padding: 12px;">${station.name}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center;"><strong>${station.heat_index}°C</strong></td>
          <td style="border: 1px solid #ddd; padding: 12px;">${station.risk_level}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${station.trend || 'N/A'}</td>
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
  
  // State for API data
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [averageHeatIndexData, setAverageHeatIndexData] = useState<AverageHI[]>([]);
  const [forecastErrorData, setForecastErrorData] = useState<ForecastError[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [synopticData, setSynopticData] = useState<SynopticData[]>([]);

  // Fetch summary data
  useEffect(() => {
    fetch(`${API_BASE_URL}/summary?date=${selectedDate}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(setSummaryData)
      .catch(err => console.error("Error fetching summary:", err));
  }, [selectedDate]);

  // Fetch nationwide heat index trend
  useEffect(() => {
    fetch(`${API_BASE_URL}/nationwide-trend?range=${heatIndexPeriod}&date=${selectedDate}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => setAverageHeatIndexData(data))
      .catch(err => console.error("Error fetching heat index trend:", err));
  }, [heatIndexPeriod, selectedDate]);

  // Fetch forecast error data
  useEffect(() => {
    fetch(`${API_BASE_URL}/forecast-error?range=${forecastErrorPeriod}&date=${selectedDate}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => setForecastErrorData(data))
      .catch(err => console.error("Error fetching forecast error:", err));
  }, [forecastErrorPeriod, selectedDate]);

  // Fetch stations table data
  useEffect(() => {
    fetch(`${API_BASE_URL}/stations-table?date=${selectedDate}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => setStations(data))
      .catch(err => console.error("Error fetching stations:", err));
  }, [selectedDate]);

  // Fetch synoptic classification data
  useEffect(() => {
    fetch(`${API_BASE_URL}/synoptic-classification?date=${selectedDate}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => setSynopticData(data))
      .catch(err => console.error("Error fetching synoptic data:", err));
  }, [selectedDate]);

  const filteredStations = classificationFilter
    ? stations.filter((station) => station.risk_level.toLowerCase() === classificationFilter.toLowerCase().replace("-", " "))
    : stations;

  const cards = [
    {
      title: "Highest Forecasted Heat Index",
      value: summaryData ? `${summaryData.max}°C` : "--",
      subtext: summaryData?.max_station || "Across all stations",
    },
    {
      title: "Lowest Forecasted Heat Index",
      value: summaryData ? `${summaryData.min}°C` : "--",
      subtext: summaryData?.min_station || "Across all stations",
    },
    {
      title: "Average Forecasted Heat Index",
      value: summaryData ? `${summaryData.avg}°C` : "--",
      subtext: "Nationwide average",
    },
    {
      title: "Number of Stations in Danger-Extreme Danger",
      value: summaryData ? `${summaryData.danger_count}` : "--",
      subtext: "stations in Luzon",
    },
    {
      title: "Most Rapidly Increasing Station (in 24 hrs)",
      value: summaryData?.fastest_increasing_trend != null
        ? `${summaryData.fastest_increasing_trend > 0 ? '+' : ''}${Number(summaryData.fastest_increasing_trend).toFixed(1)}°C` 
        : "--",
      subtext: summaryData?.fastest_increasing_station || "Based on 24h trends",
    }
  ];

  const columns = [
    { key: "name", label: "Station" },
    { key: "heat_index", label: "Heat Index" },
    { key: "risk_level", label: "Risk Level" },
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
            <LineChart data={averageHeatIndexData}>
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
            <LineChart data={forecastErrorData}>
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
                      if (col.key === "heat_index") value = `${value}°C`;

                      if (col.key === "risk_level") {
                        let badgeClass = 'inline-block px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap';
                        switch (station.risk_level) {
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
                            <span className={badgeClass}>{station.risk_level}</span>
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
