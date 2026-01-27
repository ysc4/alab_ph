"use client"; // for Next.js 13+ client component

import { useLoadScript, GoogleMap, HeatmapLayer } from "@react-google-maps/api";
import { useState, useEffect } from "react";
import StationMarker from "../components/station-marker";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface MapProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

interface StationData {
  id: number;
  name: string;
  lat: number;
  lng: number;
  temp: number;
  risk_level?: string;
  forecasted?: number;
  modelForecasted?: number;
}

interface StationDetailData {
  id: number;
  name: string;
  lat: number;
  lng: number;
  temp: number;
  forecasted: number;
  modelForecasted: number;
  riskLevel: string;
  date?: string;
}

const getTemperatureWeight = (temp: number): number => {
  // Map temperature to weight starting from Caution level (27°C)
  // Caution: 27-32°C (0-0.2), Extreme Caution: 33-41°C (0.2-0.5)
  // Danger: 42-51°C (0.5-0.8), Extreme Danger: 52°C+ (0.8-1.0)
  const minTemp = 27; // Start from Caution threshold
  const maxTemp = 55; // Max at 55°C for extreme danger
  const weight = (temp - minTemp) / (maxTemp - minTemp);
  return Math.max(0, Math.min(1, weight));
};

export default function HeatMapDummy({ selectedDate }: MapProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ["visualization", "marker"],
  });

  const [heatmapData, setHeatmapData] = useState<google.maps.visualization.WeightedLocation[]>([]);
  const [stationPoints, setStationPoints] = useState<StationData[]>([]);
  const [openMarker, setOpenMarker] = useState<number | null>(null);
  const [stationDetails, setStationDetails] = useState<StationDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        console.log('Fetching stations with date:', selectedDate);
        const response = await fetch(`${API_BASE_URL}/stations-map?date=${selectedDate}`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response error:', errorText);
          throw new Error(`Failed to fetch stations: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Fetched stations count:', data.length);
        console.log('Sample station data:', data[0]);
        console.log('Station risk levels:', data.map((s: StationData) => ({ name: s.name, risk: s.risk_level })).slice(0, 5));
        setStationPoints(data);
      } catch (error) {
        console.error("Error fetching stations:", error);
        // Set empty array so map still loads
        setStationPoints([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStations();
  }, [selectedDate]);

  const handleStationMarkerClick = async (stationId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/station-markers/${stationId}?date=${selectedDate}`);
      if (!response.ok) throw new Error("Failed to fetch station details");
      const data = await response.json();
      setStationDetails(data);
      setOpenMarker(data.id);
    } catch (error) {
      console.error("Error fetching station details:", error);
    }
  };

  useEffect(() => {
    if (!isLoaded || stationPoints.length === 0) return;

    const points = stationPoints
      .filter((p) => p.temp >= 27) // Only include stations with Caution level or above (>= 27°C)
      .map((p) => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        weight: getTemperatureWeight(p.temp),
      }));

    setHeatmapData(points);
  }, [isLoaded, stationPoints]);

  if (!isLoaded || loading) return (
    <div style={{ 
      width: "100%", 
      height: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      fontSize: "18px",
      color: "#666"
    }}>
      Loading Map...
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {/* Legend */}
      <div style={{ 
        position: "absolute", 
        top: "60px", 
        right: "10px",
        zIndex: 1000,
        backgroundColor: "white",
        padding: "16px",
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        minWidth: "180px"
      }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "bold", color: "#333" }}>
          Risk Levels
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#4CAF50", border: "2px solid white" }}></div>
            <span style={{ fontSize: "12px", color: "#666" }}>Below Caution (&lt;27°C)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#FFC107", border: "2px solid white" }}></div>
            <span style={{ fontSize: "12px", color: "#666" }}>Caution (27-32°C)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#FB923C", border: "2px solid white" }}></div>
            <span style={{ fontSize: "12px", color: "#666" }}>Extreme Caution (33-41°C)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#F44336", border: "2px solid white" }}></div>
            <span style={{ fontSize: "12px", color: "#666" }}>Danger (42-51°C)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#B71C1C", border: "2px solid white" }}></div>
            <span style={{ fontSize: "12px", color: "#666" }}>Extreme Danger (52°C+)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#9E9E9E", border: "2px solid white" }}></div>
            <span style={{ fontSize: "12px", color: "#666" }}>No Data</span>
          </div>
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={{ lat: 12.8797, lng: 121.774 }}
        zoom={5}
        options={{
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
        }}
        onLoad={(map) => {
          setMapInstance(map);
          (window as any).__GOOGLE_MAP_INSTANCE__ = map;
        }}
      >
        {heatmapData.length > 0 && (
          <HeatmapLayer
            data={heatmapData}
            options={{
              radius: 50,
              opacity: 0.8,
              dissipating: true,
              gradient: [
                "rgba(255, 255, 255, 0)",      // Transparent (outermost)
                "rgba(255, 193, 7, 0.3)",      // Caution - Yellow (start)
                "rgba(255, 193, 7, 0.6)",      // Caution - Yellow
                "rgba(255, 193, 7, 0.8)",      // Caution - Yellow
                "rgba(251, 146, 60, 0.6)",      // Extreme Caution - Orange
                "rgba(251, 146, 60, 0.8)",      // Extreme Caution - Orange
                "rgba(251, 146, 60, 1)",        // Extreme Caution - Orange
                "rgba(244, 67, 54, 0.7)",      // Danger - Red
                "rgba(244, 67, 54, 0.9)",      // Danger - Red
                "rgba(244, 67, 54, 1)",        // Danger - Red
                "rgba(183, 28, 28, 0.9)",      // Extreme Danger - Dark Red
                "rgba(183, 28, 28, 1)",        // Extreme Danger - Dark Red (high intensity)
              ],
            }}
          />
        )}
        {stationPoints.map((point) => (
          <StationMarker
            key={point.id}
            id={point.id}
            lat={point.lat}
            lng={point.lng}
            temp={point.temp}
            name={point.name}
            forecasted={point.forecasted}
            modelForecasted={point.modelForecasted}
            riskLevel={point.risk_level}
            selectedDate={selectedDate}
            isOpen={openMarker === point.id}
            onOpen={() => handleStationMarkerClick(point.id)}
            onClose={() => setOpenMarker(null)}
          />
        ))}
      </GoogleMap>
    </div>
  );
}