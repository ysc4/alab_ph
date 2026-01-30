'use client';
import React, { useRef, useState } from "react";
import { Download, CloudSun } from "lucide-react";
import DateSelector from "./date-selector";
import StationSelector from "./station-selector";
import { useLoading } from "../context/LoadingContext";

// TooltipButton component for floating tooltip at cursor
interface TooltipButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  label: string;
}

const TooltipButton: React.FC<TooltipButtonProps> = ({ icon, onClick, label }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ height: 48, position: "relative", display: "flex", alignItems: "center" }}>
      <button
        ref={btnRef}
        className="rounded-full flex items-center justify-center bg-transparent transition-colors focus:outline-none"
        style={{
          width: 48,
          height: 48,
          border: "2px solid var(--primary)",
          color: "var(--primary)",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          verticalAlign: "middle",
          padding: 0,
          background: tooltip ? "var(--primary)" : "transparent",
          transition: "background 0.2s, color 0.2s"
        }}
        onMouseEnter={e => {
          setTooltip({ x: e.clientX, y: e.clientY });
          e.currentTarget.style.background = 'var(--primary)';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseMove={e => {
          setTooltip({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={e => {
          setTooltip(null);
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--primary)';
        }}
        onClick={onClick}
        aria-label={label}
      >
        {icon}
      </button>
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            zIndex: 9999,
            background: "#1E293B",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 13,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            opacity: 1,
            transition: "opacity 0.15s"
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

type PageKey = "Home" | "Map" | "Station";

interface HeaderProps {
  title: string;
  activePage?: PageKey;
  selectedDate?: string;
  selectedStationId?: number;
  onStationSelect?: (stationId: number) => void;
  onDateSelect?: (date: string) => void;
  onDownload?: () => void;
  onGenerateData?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  activePage,
  selectedDate,
  selectedStationId,
  onStationSelect,
  onDateSelect,
  onDownload,
  onGenerateData
}) => {
  const { startLoading, stopLoading } = useLoading();

  const handleGenerateForecast = async () => {
    if (!onGenerateData) return;

    try {
      startLoading();          
      await onGenerateData();   
    } catch (error) {
      console.error("Forecast generation failed:", error);
    } finally {
      stopLoading();           
    }
  };

  return (
    <header className="flex items-center justify-between pt-8">
      <h1 className="text-[36px] font-extrabold text-text-primary">
        <span style={{ fontWeight: "bolder" }}>{title}</span>
      </h1>

      {activePage === "Home" && (
        <div className="flex gap-4">
          <TooltipButton
            icon={
              <CloudSun
                className="w-5 h-5 icon-forecast"
                style={{ color: "inherit", transition: "color 0.2s" }}
              />
            }
            onClick={handleGenerateForecast}
            label="Forecast Heat Index"
          />

          <TooltipButton
            icon={
              <Download
                className="w-5 h-5 icon-download"
                style={{ color: "inherit", transition: "color 0.2s" }}
              />
            }
            onClick={onDownload}
            label="Download Forecast Report"
          />

          <DateSelector value={selectedDate} onSelect={onDateSelect} />
        </div>
      )}

      {activePage === "Map" && (
        <div className="flex gap-4">
          <DateSelector value={selectedDate} onSelect={onDateSelect} />
        </div>
      )}

      {activePage === "Station" && (
        <div className="flex gap-4">
          <DateSelector value={selectedDate} onSelect={onDateSelect} />
          <StationSelector
            selectedStationId={selectedStationId}
            onSelect={onStationSelect}
          />
        </div>
      )}
    </header>
  );
};


export default Header;
