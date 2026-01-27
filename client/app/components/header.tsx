import React from "react";
import DateSelector from "./date-selector";
import StationSelector from "./station-selector";

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

const Header: React.FC<HeaderProps> = ({ title, activePage, selectedDate, selectedStationId, onStationSelect, onDateSelect, onDownload, onGenerateData }) => {
  return (
    <header className="flex items-center justify-between pt-8">
      <h1 className="text-[36px] font-extrabold text-text-primary">
        {title}
      </h1>
      {activePage === "Home" && (
        <div className="flex gap-4">
          <button 
            className="px-4 py-2 rounded-2xl focus:outline-none hover:shadow-lg"
            style={{ 
              backgroundColor: '#10B981', 
              color: 'white', 
              fontWeight: '500'
            }}
            onClick={onGenerateData}
          >
            Forecast
          </button>
          <button 
            className="px-4 py-2 rounded-2xl focus:outline-none hover:shadow-lg"
            style={{ 
              backgroundColor: '#1666BA', 
              color: 'white', 
              fontWeight: '500'
            }}
            onClick={onDownload}
          >
            Download
          </button>
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
          <StationSelector selectedStationId={selectedStationId} onSelect={onStationSelect} />
        </div>
      )}
    </header>
  );
};

export default Header;
