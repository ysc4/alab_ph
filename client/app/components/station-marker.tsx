"use client";

import { InfoWindow } from "@react-google-maps/api";
import { Radio } from "lucide-react";
import { FC, useRef, useEffect, useState } from "react";


interface StationMarkerProps {
  id: number;
  lat: number;
  lng: number;
  temp: number;
  name: string;
  forecasted?: number;
  modelForecasted?: number;
  riskLevel?: string;
  selectedDate?: string;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

const getMarkerColorFromRiskLevel = (riskLevel?: string): string => {
  if (!riskLevel || riskLevel === 'N/A') return "#9E9E9E"; // Gray for no data
  const level = riskLevel.toLowerCase().trim();
  
  // Match exact classifications from database
  if (level === "extreme danger") return "#B71C1C"; // Dark red
  if (level === "danger") return "#F44336"; // Red
  if (level === "extreme caution") return "#FB923C"; // Orange
  if (level === "caution") return "#FFC107"; // Amber/Yellow
  if (level === "below caution") return "#4CAF50"; // Green for N/A
  
  // Fallback for any unmatched values
  return "#9E9E9E"; // Gray for unknown
};

const getMarkerColor = (temp: number): string => {
  if (!temp || temp === 0) return "#9E9E9E"; // Gray for no data
  if (temp > 52) return "#B71C1C"; // Extreme Danger
  if (temp >= 42) return "#F44336"; // Danger
  if (temp >= 33) return "#FB923C"; // Extreme Caution
  if (temp >= 27) return "#FFC107"; // Caution
  return "#4CAF50"; // Green for temperatures below caution
};

const getClassification = (temp: number): string => {
  if (!temp || temp === 0) return "No Data";
  if (temp > 52) return "Extreme Danger";
  if (temp >= 42) return "Danger";
  if (temp >= 33) return "Extreme Caution";
  if (temp >= 27) return "Caution";
  return "Below Caution";
};

const StationMarker: FC<StationMarkerProps> = ({ id, lat, lng, temp, name, forecasted, modelForecasted, riskLevel, selectedDate, isOpen = false, onOpen, onClose }) => {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const markerColor = riskLevel ? getMarkerColorFromRiskLevel(riskLevel) : getMarkerColor(temp);
  const classification = riskLevel || getClassification(temp);

  // Get map instance from window (injected by GoogleMap component)
  useEffect(() => {
    const getMapInstance = () => {
      const mapElement = document.querySelector('[role="region"]');
      if (mapElement && (window as any).__GOOGLE_MAP_INSTANCE__) {
        setMap((window as any).__GOOGLE_MAP_INSTANCE__);
      }
    };
    
    setTimeout(getMapInstance, 100);
  }, []);

  // Create and update AdvancedMarkerElement
  useEffect(() => {
    if (!map) return;

    // Create marker content
    const markerContent = document.createElement('div');
    markerContent.style.width = '32px';
    markerContent.style.height = '32px';
    markerContent.style.borderRadius = '50%';
    markerContent.style.backgroundColor = markerColor;
    markerContent.style.border = '3px solid white';
    markerContent.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    markerContent.style.display = 'flex';
    markerContent.style.alignItems = 'center';
    markerContent.style.justifyContent = 'center';
    markerContent.style.cursor = 'pointer';
    markerContent.style.transition = 'transform 0.2s ease';
    markerContent.style.fontSize = '10px';
    markerContent.style.fontWeight = 'bold';
    markerContent.style.color = 'white';
    markerContent.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.3)';
    markerContent.textContent = `${Math.round(temp)}°`;

    // Add hover effects
    markerContent.addEventListener('mouseenter', () => {
      markerContent.style.transform = 'scale(1.2)';
    });
    markerContent.addEventListener('mouseleave', () => {
      markerContent.style.transform = 'scale(1)';
    });

    // Create advanced marker
    const advancedMarker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat, lng },
      title: name,
      content: markerContent,
    });

    // Add click listener
    advancedMarker.addListener('click', () => {
      onOpen?.();
    });

    markerRef.current = advancedMarker;

    return () => {
      advancedMarker.map = null;
    };
  }, [map, lat, lng, temp, markerColor, name, onOpen]);

  return (
    <>
      <div ref={containerRef} style={{ display: 'none' }} />
      {isOpen && (
        <InfoWindow position={{ lat, lng }} onCloseClick={() => onClose?.()}>
          <div className="min-w-100">
            <div className="bg-primary text-white py-3 rounded-t-md text-center font-sans">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Radio className="w-5 h-5" />
                <h3 className="text-lg font-bold">{name}</h3>
              </div>
              <p className="text-xs opacity-90">
                [{lat.toFixed(6)}, {lng.toFixed(6)}]
              </p>
            </div>

            <div className="grid grid-cols-3 px-2 py-4">
              {(() => {
                const shouldShowPagasa = () => {
                  if (!selectedDate || !forecasted) return false;
                  const date = new Date(selectedDate);
                  const year = date.getFullYear();
                  const month = date.getMonth() + 1;
                  return year === 2023 && month >= 3 && month <= 5;
                };

                // Helper to get color from classification
                const getColorForValue = (val: number) => {
                  const classification = getClassification(val);
                  return getMarkerColorFromRiskLevel(classification);
                };

                const heatSections = [
                  ...(shouldShowPagasa()
                    ? [{
                        label: "PAGASA-Forecasted Heat Index",
                        value: forecasted || 0,
                        color: getColorForValue(forecasted || 0)
                      }]
                    : []),
                  {
                    label: "Actual Heat Index",
                    value: temp || 0,
                    color: markerColor
                  },
                  {
                    label: "Model-Forecasted Heat Index",
                    value: modelForecasted || 0,
                    color: getColorForValue(modelForecasted || 0)
                  },
                ];

                return heatSections.map((section, idx) => (
                  <div
                    key={idx}
                    className={`text-center px-3 ${idx < 2 ? "border-r border-gray-300" : ""}`}
                  >
                    <p className="text-md text-gray-600 font-semibold mb-2 font-sans leading-tight">
                      {section.label.split(" ").map((w, i) =>
                        i === 1 ? (
                          <span key={i}><br />{w} </span>
                        ) : (
                          <span key={i}>{w} </span>
                        )
                      )}
                    </p>
                    <p
                      className="text-2xl font-bold font-sans"
                      style={{ color: section.color }}
                    >
                      {Number(section.value).toFixed(1)}°C
                    </p>
                  </div>
                ));
              })()}
            </div>

            <div className="bg-gray-100 border-t border-gray-300 px-4 py-3 text-center font-sans">
              <p className="text-s text-gray-600">
                <strong>Risk Level:</strong>{" "}
                <span className="font-bold" style={{ color: markerColor }}>
                  {classification}
                </span>
              </p>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export default StationMarker;
