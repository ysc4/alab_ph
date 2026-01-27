"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./components/sidebar";
import Header from "./components/header";
import Home from "./pages/home";
import Station from "./pages/station";
import Map from "./pages/map";
import { API_BASE_URL } from "./utils/api";

type PageKey = "Home" | "Map" | "Station";

export default function Page(): React.ReactNode {
  const [activePage, setActivePage] = useState<PageKey>("Home");
  const [selectedStationId, setSelectedStationId] = useState<number>(1); // Ambulong
  const [selectedDate, setSelectedDate] = useState<string>('2023-03-02'); // March 2, 2023
  const homeRef = useRef<{ downloadData: () => void; refreshData: () => void }>(null);

  const handleDownload = () => {
    if (homeRef.current) {
      homeRef.current.downloadData();
    }
  };

  const handleGenerateData = async () => {
    try {
      const confirmed = confirm(
        `Generate forecasts for ${selectedDate}?\n\n` +
        `This will create predictions for tomorrow and day after tomorrow using the XGBoost model.`
      );
      
      if (!confirmed) return;

      const response = await fetch(`${API_BASE_URL}/generate-forecasts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: selectedDate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to generate forecasts');
      }

      const result = await response.json();
      
      // Refresh the Home page data to show updated forecasts
      if (homeRef.current) {
        homeRef.current.refreshData();
      }
      
      alert(
        `✅ Success!\n\n` +
        `${result.message}\n\n` +
        `Date: ${result.date}\n` +
        `Tomorrow: ${result.tomorrow_date}\n` +
        `Day After Tomorrow: ${result.day_after_tomorrow_date}\n` +
        `Stations Processed: ${result.stations_processed}\n\n` +
        `The page will now refresh to show the updated data.`
      );
    } catch (error) {
      console.error('Error generating data:', error);
      alert(
        `❌ Error generating forecasts:\n\n` +
        `${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const pageTitles: Record<PageKey, string> = {
    Home: "Heat Index Overview",
    Map: "PAGASA Synoptic Stations Map",
    Station: "Station Analytics",
  };

  return (
    <div className="app-container">
      <Sidebar activePage={activePage} onPageChange={setActivePage} />
      <div className="main-content">
        <Header 
          title={pageTitles[activePage]} 
          activePage={activePage} 
          selectedDate={selectedDate}
          selectedStationId={selectedStationId}
          onStationSelect={setSelectedStationId} 
          onDateSelect={setSelectedDate}
          onDownload={handleDownload}
          onGenerateData={handleGenerateData}
        />
        <div className="content-placeholder">
          {activePage === "Home" && <Home ref={homeRef} selectedDate={selectedDate} onDateSelect={setSelectedDate} />}
          {activePage === "Map" && <Map selectedDate={selectedDate} onDateSelect={setSelectedDate} />}
          {activePage === "Station" && <Station selectedStationId={selectedStationId} selectedDate={selectedDate} onStationSelect={setSelectedStationId} onDateSelect={setSelectedDate} />}
        </div>
      </div>
    </div>
  );
}
