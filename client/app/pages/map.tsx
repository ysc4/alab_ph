"use client"; // for Next.js 13+ client component

import { useLoadScript, GoogleMap, HeatmapLayer } from "@react-google-maps/api";
import { useState, useEffect } from "react";
import StationMarker from "../components/station-marker";

interface StationData {
  id: number;
  name: string;
  lat: number;
  lng: number;
  temp: number;
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
}

const getTemperatureWeight = (temp: number): number => {
  // Map temperature ranges to gradient (27°C = 0, 53°C = 1)
  // Caution: 27-32°C, Extreme Caution: 33-41°C, Danger: 42-51°C, Extreme Danger: 52°C+
  const minTemp = 27;
  const maxTemp = 53;
  const weight = (temp - minTemp) / (maxTemp - minTemp);
  return Math.max(0, Math.min(1, weight));
};

export default function HeatMapDummy() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ["visualization"],
  });

  const [heatmapData, setHeatmapData] = useState<google.maps.visualization.WeightedLocation[]>([]);
  const [stationPoints, setStationPoints] = useState<StationData[]>([]);
  const [openMarker, setOpenMarker] = useState<string | null>(null);
  const [stationDetails, setStationDetails] = useState<StationDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await fetch("http://localhost:4001/api/stations");
        if (!response.ok) throw new Error("Failed to fetch stations");
        const data = await response.json();
        setStationPoints(data);
      } catch (error) {
        console.error("Error fetching stations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStations();
  }, []);

  const handleStationMarkerClick = async (stationId: number) => {
    try {
      const response = await fetch(`http://localhost:4001/api/stationMarkers/${stationId}`);
      if (!response.ok) throw new Error("Failed to fetch station details");
      const data = await response.json();
      setStationDetails(data);
      setOpenMarker(data.name);
    } catch (error) {
      console.error("Error fetching station details:", error);
    }
  };

  useEffect(() => {
    if (!isLoaded || stationPoints.length === 0) return;

    const points = stationPoints.map((p) => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      weight: getTemperatureWeight(p.temp),
    }));

    setHeatmapData(points);
  }, [isLoaded, stationPoints]);

  if (!isLoaded || loading) return <div>Loading Map...</div>;

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={{ lat: 12.8797, lng: 121.774 }}
        zoom={5}
      >
        {heatmapData.length > 0 && (
          <HeatmapLayer
            data={heatmapData}
            options={{
              radius: 50,
              opacity: 0.8,
              gradient: [
                "rgba(255, 255, 255, 0)",
                "rgba(255, 235, 59, 0.1)",
                "rgba(255, 235, 59, 0.2)",
                "rgba(255, 235, 59, 0.4)",
                "rgba(255, 235, 59, 0.6)",
                "rgba(255, 235, 59, 0.8)",
                "rgba(255, 193, 7, 1)",
                "rgba(255, 179, 71, 1)",
                "rgba(255, 152, 0, 1)",
                "rgba(255, 152, 0, 1)",
                "rgba(255, 138, 101, 1)",
                "rgba(255, 112, 67, 1)",
                "rgba(244, 67, 54, 1)",
                "rgba(229, 87, 83, 1)",
                "rgba(229, 57, 53, 1)",
                "rgba(211, 47, 47, 1)",
                "rgba(183, 28, 28, 1)",
              ],
            }}
          />
        )}
        {stationPoints.map((point) => (
          <StationMarker
            key={point.name}
            id={point.id}
            lat={point.lat}
            lng={point.lng}
            temp={point.temp}
            name={point.name}
            forecasted={stationDetails?.forecasted}
            modelForecasted={stationDetails?.modelForecasted}
            riskLevel={stationDetails?.riskLevel}
            isOpen={openMarker === point.name}
            onOpen={() => handleStationMarkerClick(point.id)}
            onClose={() => setOpenMarker(null)}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
