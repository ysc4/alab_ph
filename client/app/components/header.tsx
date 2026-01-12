import React from "react";
import DateSelector from "./date-selector";
import StationSelector from "./station-selector";

type PageKey = "Home" | "Map" | "Station";

interface HeaderProps {
  title: string;
  activePage?: PageKey;
  selectedDate?: string;
  onStationSelect?: (stationId: number) => void;
  onDateSelect?: (date: string) => void;
}

const Header: React.FC<HeaderProps> = ({ title, activePage, selectedDate, onStationSelect, onDateSelect }) => {
  return (
    <header className="flex items-center justify-between pt-8">
      <h1 className="text-[36px] font-extrabold text-text-primary">
        {title}
      </h1>
      {activePage === "Home" && (
        <div className="flex gap-4">
          <DateSelector value={selectedDate} onSelect={onDateSelect} />
        </div>
      )}
      {activePage === "Station" && (
        <div className="flex gap-4">
          <DateSelector value={selectedDate} onSelect={onDateSelect} />
          <StationSelector onSelect={onStationSelect} />
        </div>
      )}
    </header>
  );
};

export default Header;
