"use client";

import React, { useState, useRef } from "react";
import Sidebar from "./components/sidebar";
import Header from "./components/header";
import Home from "./pages/home";
import Station from "./pages/station";
import Map from "./pages/map";
import GlobalLoader from "./components/loading-page";
import { LoadingProvider, useLoading } from "./context/LoadingContext";
import { API_BASE_URL } from "./utils/api";

type PageKey = "Home" | "Map" | "Station";

// This component wraps Page with GlobalLoader and useLoading hook
function PageContent(): React.ReactNode {
  const { isLoading } = useLoading();

  return (
    <>
      <GlobalLoader isLoading={isLoading} />
      <Page />
    </>
  );
}

// Main Page component (dashboard)
function Page(): React.ReactNode {
  const [activePage, setActivePage] = useState<PageKey>("Home");
  const [selectedStationId, setSelectedStationId] = useState<number>(1); // Default station
  const [selectedDate, setSelectedDate] = useState<string>('2023-03-03'); // Default date
  const homeRef = useRef<{ downloadData: () => void; refreshData: () => void }>(null);

  const { startLoading, stopLoading } = useLoading();

  // Download handler
  const handleDownload = () => {
    if (homeRef.current) {
      homeRef.current.downloadData();
    }
  };

  // Generate forecasts handler
  const handleGenerateData = async () => {
    try {
      const confirmed = confirm(
        `Generate forecasts for ${selectedDate}?\n\n` +
        `This will create predictions for tomorrow and day after tomorrow using the XGBoost model.`
      );
      if (!confirmed) return;

      startLoading(); // show loader

      const response = await fetch(`${API_BASE_URL}/generate-forecasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      alert(`Success!\n\n${result.message}\n\n`);
    } catch (error) {
      console.error('Error generating data:', error);
      alert(`Error generating forecasts:\n\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      stopLoading(); // hide loader
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
          {activePage === "Home" && (
            <Home
              ref={homeRef}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          )}
          {activePage === "Map" && (
            <Map
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          )}
          {activePage === "Station" && (
            <Station
              selectedStationId={selectedStationId}
              selectedDate={selectedDate}
              onStationSelect={setSelectedStationId}
              onDateSelect={setSelectedDate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Export the page wrapped in LoadingProvider + GlobalLoader
export default function PageWithLoading(): React.ReactNode {
  return (
    <LoadingProvider>
      <PageContent />
    </LoadingProvider>
  );
}
