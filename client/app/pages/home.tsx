import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Toggle from "../components/toggle";
import ClassificationSelector from "../components/classification-selector";
import { formatDateShort } from "../utils/dateFormatter";

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

interface HomeProps {
  selectedDate: string;
  onDateSelect?: (date: string) => void;
}

const Home = forwardRef<{ downloadData: () => void }, HomeProps>(({ selectedDate, onDateSelect }, ref) => {
  const [heatIndexPeriod, setHeatIndexPeriod] = useState<"Week" | "Month">("Week");
  const [forecastErrorPeriod, setForecastErrorPeriod] = useState<"Week" | "Month">("Week");
  const [classificationFilter, setClassificationFilter] = useState<string>("");
  
  // State for API data
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [averageHeatIndexData, setAverageHeatIndexData] = useState<AverageHI[]>([]);
  const [forecastErrorData, setForecastErrorData] = useState<ForecastError[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [synopticData, setSynopticData] = useState<SynopticData[]>([]);

  // Download function that uses selectedDate from props
  const downloadHomeData = async () => {
    try {
      console.log('Fetching stations data for date:', selectedDate);
      const response = await fetch(`${API_BASE_URL}/stations-full-data?date=${selectedDate}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stations data: ${response.status} ${response.statusText}`);
      }

      const stationsData = await response.json();
      console.log('Stations data received:', stationsData.length, 'stations');

      // Helper function for coloring based on heat index
      const getHeatIndexColor = (value: number) => {
        if (value >= 27) return "#FFC107";       
        if (value >= 33) return "#FF9800";       
        if (value >= 42) return "#F44336";       
        return "#B71C1C";                        
      };

      // Create hidden container for PDF generation
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "1200px";
      container.style.backgroundColor = "white";
      container.style.padding = "20px";
      container.style.fontFamily = "Arial, sans-serif";

      // Build table HTML
      let tableHTML = `
        <div style="padding: 20px;">
          <h1 style="text-align: center; margin-bottom: 10px;">HEAT INDEX FORECAST COMPILATION REPORT</h1>
          <h3 style="text-align: center; margin-bottom: 5px;">Forecasted Heat Index Values per Synoptic Station</h3>
          <p style="text-align: center; margin-bottom: 20px;">
            Coverage: Synoptic Stations in Luzon<br/>
            Forecast Horizon: T+1 & T+2 Days (where T is Today)<br/>
            Reporting Period: ${formatDateShort(selectedDate)}
          </p>
          <table style="width: 100%; border-collapse: collapse; text-align: center;">
            <thead>
              <tr style="background-color: #1E40AF; color: white;">
                <th style="border: 1px solid #000; padding: 8px;">Station</th>
                <th style="border: 1px solid #000; padding: 8px;">Forecasted Heat Index (T+1)</th>
                <th style="border: 1px solid #000; padding: 8px;">Forecasted Heat Index (T+2)</th>
                <th style="border: 1px solid #000; padding: 8px;">RMSE</th>
                <th style="border: 1px solid #000; padding: 8px;">MAE</th>
                <th style="border: 1px solid #000; padding: 8px;">R²</th>
              </tr>
            </thead>
            <tbody>
      `;

      stationsData.forEach((station: any) => {
        tableHTML += `
          <tr>
            <td style="border: 1px solid #000; padding: 6px; text-align: left;">${station.name}</td>
            <td style="border: 1px solid #000; padding: 6px; background-color: ${getHeatIndexColor(station.t_plus_one)};">
              ${station.t_plus_one}°C
            </td>
            <td style="border: 1px solid #000; padding: 6px; background-color: ${getHeatIndexColor(station.t_plus_two)};">
              ${station.t_plus_two}°C
            </td>
            <td style="border: 1px solid #000; padding: 6px;">${station.rmse}</td>
            <td style="border: 1px solid #000; padding: 6px;">${station.mae}</td>
            <td style="border: 1px solid #000; padding: 6px;">${station.rsquared}</td>
          </tr>
        `;
      });

      tableHTML += `
            </tbody>
          </table>
        </div>
      `;

      container.innerHTML = tableHTML;
      document.body.appendChild(container);

      console.log('Starting PDF generation...');

      const canvas = await html2canvas(container, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const imgWidth = 297; // A4 landscape width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= 210;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= 210;
      }

      pdf.save(`alab-ph-heat-index-report-${selectedDate}.pdf`);
      console.log('PDF saved successfully');

      document.body.removeChild(container);
      console.log('Cleanup complete');

    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`Error generating PDF: ${error instanceof Error ? error.message : error}`);
    }
  };


  // Fetch summary data
  useEffect(() => {
    fetch(`${API_BASE_URL}/summary?date=${selectedDate}`)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Summary response error:', text);
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => setSummaryData(data))
      .catch(err => console.error("Error fetching summary:", err));
  }, [selectedDate]);

  // Fetch nationwide heat index trend
  useEffect(() => {
    fetch(`${API_BASE_URL}/nationwide-trend?range=${heatIndexPeriod}&date=${selectedDate}`)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Trend response error:', text);
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => setAverageHeatIndexData(data))
      .catch(err => console.error("Error fetching heat index trend:", err));
  }, [heatIndexPeriod, selectedDate]);

  // Fetch forecast error data
  useEffect(() => {
    fetch(`${API_BASE_URL}/forecast-error?range=${forecastErrorPeriod}&date=${selectedDate}`)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Forecast error response error:', text);
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => setForecastErrorData(data))
      .catch(err => console.error("Error fetching forecast error:", err));
  }, [forecastErrorPeriod, selectedDate]);

  // Fetch stations table data
  useEffect(() => {
    fetch(`${API_BASE_URL}/stations-table?date=${selectedDate}`)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Stations response error:', text);
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => setStations(data))
      .catch(err => console.error("Error fetching stations:", err));
  }, [selectedDate]);

  // Fetch synoptic classification data
  useEffect(() => {
    fetch(`${API_BASE_URL}/synoptic-classification?date=${selectedDate}`)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Synoptic response error:', text);
          throw new Error(`HTTP error! status: ${res.status}`);
        }
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
      subtext: "Luzon-wide average",
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

  // Expose downloadHomeData function to parent via ref
  useImperativeHandle(ref, () => ({
    downloadData: downloadHomeData
  }));


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
          <h2 className="text-2xl font-extrabold">Luzon-wide Heat Index</h2>
          <Toggle options={["Week", "Month"]} onSelect={(selected) => setHeatIndexPeriod(selected as "Week" | "Month")} />
        </div>
        <div className="flex-1 w-full">
          {averageHeatIndexData.length > 0 ? (
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
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-gray-500">No data available for the selected period</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 bg-white rounded-xl shadow flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-extrabold">Absolute Forecast Error</h2>
          <Toggle options={["Week", "Month"]} onSelect={(selected) => setForecastErrorPeriod(selected as "Week" | "Month")} />
        </div>
        <div className="flex-1 w-full">
          {forecastErrorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={forecastErrorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="t_plus_one" stroke="#1E40AF" name="1-Day Ahead Error" />
                <Line type="monotone" dataKey="t_plus_two" stroke="#7AB3EF" name="2-Day Ahead Error" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-gray-500">No data available for the selected period</p>
            </div>
          )}
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
        {synopticData.length > 0 ? (
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
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  </div>

</div>

  );
});

Home.displayName = 'Home';

export default Home;
