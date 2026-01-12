"use client";

import { Marker, InfoWindow } from "@react-google-maps/api";
import { SignalIcon } from "@heroicons/react/24/outline";
import { useState, FC } from "react";

interface StationMarkerProps {
  id: number;
  lat: number;
  lng: number;
  temp: number;
  name: string;
  forecasted?: number;
  modelForecasted?: number;
  riskLevel?: string;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

const getMarkerColor = (temp: number): string => {
  if (temp > 52) return "#B71C1C"; // Extreme Danger
  if (temp >= 42) return "#F44336"; // Danger
  if (temp >= 33) return "#FF9800"; // Extreme Caution
  return "#FFC107"; // Caution
};

const getClassification = (temp: number): string => {
  if (temp > 52) return "Extreme Danger";
  if (temp >= 42) return "Danger";
  if (temp >= 33) return "Extreme Caution";
  return "Caution";
};

const StationMarker: FC<StationMarkerProps> = ({ id, lat, lng, temp, name, forecasted, modelForecasted, riskLevel, isOpen = false, onOpen, onClose }) => {

  const markerColor = getMarkerColor(temp);
  const classification = riskLevel || getClassification(temp);

  const svgMarker = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${markerColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="${markerColor}"/>
    </svg>
  `);

  const icon: google.maps.Icon = {
    url: `data:image/svg+xml;charset=UTF-8,${svgMarker}`,
    scaledSize: new google.maps.Size(40, 50),
    anchor: new google.maps.Point(20, 50),
  };

  const heatSections = [
    ...(forecasted && forecasted > 0 ? [{ label: "PAGASA-Forecasted Heat Index", value: forecasted, color: "#1666BA" }] : []),
    { label: "Actual Heat Index", value: temp, color: markerColor },
    { label: "Model-Forecasted Heat Index", value: modelForecasted || temp, color: "#1666BA" },
  ];

  return (
    <>
      <Marker
        position={{ lat, lng }}
        icon={icon}
        onClick={() => onOpen?.()}
        title={name}
      />
      {isOpen && (
        <InfoWindow position={{ lat, lng }} onCloseClick={() => onClose?.()}>
          <div className="min-w-100">
            <div className="bg-primary text-white py-3 rounded-t-md text-center font-sans">
              <div className="flex items-center justify-center gap-2 mb-1">
                <SignalIcon className="w-5 h-5" />
                <h3 className="text-lg font-bold">{name}</h3>
              </div>
              <p className="text-xs opacity-90">
                [{lat.toFixed(6)}, {lng.toFixed(6)}]
              </p>
            </div>

            <div className="grid grid-cols-3 px-2 py-4">
              {heatSections.map((section, idx) => (
                <div
                  key={idx}
                  className={`text-center px-3 ${idx < 2 ? "border-r border-gray-300" : ""}`}
                >
                  <p className="text-md text-gray-600 font-semibold mb-2 font-sans leading-tight">
                    {section.label.split(" ").map((w, i) =>
                      i === 1 ? (
                        <><br key={i} />{w} </> 
                      ) : (
                        w + " "
                      )
                    )}
                  </p>
                  <p
                    className="text-2xl font-bold font-sans"
                    style={{ color: section.color }}
                  >
                    {section.value}°C
                  </p>
                </div>
              ))}
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
