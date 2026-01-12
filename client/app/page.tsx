"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "./components/sidebar";
import Header from "./components/header";
import Home from "./pages/home";
import Station from "./pages/station";
import Map from "./pages/map";

type PageKey = "Home" | "Map" | "Station";

export default function Page(): React.ReactNode {
  const [activePage, setActivePage] = useState<PageKey>("Home");
  const [selectedStationId, setSelectedStationId] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Reset filters to today when navigating to Station page
  useEffect(() => {
    if (activePage === "Station") {
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setSelectedStationId(1);
    }
  }, [activePage]);

  const pageTitles: Record<PageKey, string> = {
    Home: "Heat Index Overview",
    Map: "PAGASA Synoptic Stations Map",
    Station: "Station Analytics",
  };

  return (
    <div className="app-container">
      <Sidebar activePage={activePage} onPageChange={setActivePage} />
      <div className="main-content">
        <Header title={pageTitles[activePage]} activePage={activePage} selectedDate={selectedDate} onStationSelect={setSelectedStationId} onDateSelect={setSelectedDate} />
        <div className="content-placeholder">
          {activePage === "Home" && <Home selectedDate={selectedDate} onDateSelect={setSelectedDate} />}
          {activePage === "Map" && <Map />}
          {activePage === "Station" && <Station selectedStationId={selectedStationId} selectedDate={selectedDate} onStationSelect={setSelectedStationId} onDateSelect={setSelectedDate} />}
        </div>
      </div>
    </div>
  );
}
