import { ChevronDownIcon } from "@heroicons/react/24/outline";

interface StationSelectorProps {
  onSelect?: (stationId: number) => void;
}

const StationSelector: React.FC<StationSelectorProps> = ({ onSelect }) => {
  const stations = [
    { id: 1, name: "Ambulong" },
    { id: 2, name: "Baguio City" },
    { id: 3, name: "Baler" },
    { id: 4, name: "Basco" },
    { id: 5, name: "Calapan" },
    { id: 6, name: "Clark Airport" },
    { id: 7, name: "Daet" },
    { id: 8, name: "Dagupan City" },
    { id: 9, name: "Iba" },
    { id: 10, name: "Infanta" },
    { id: 11, name: "Laoag City" },
    { id: 12, name: "Legazpi City" },
    { id: 13, name: "NAIA" },
    { id: 14, name: "Port Area" },
    { id: 15, name: "Puerto Princesa" },
    { id: 16, name: "San Jose" },
    { id: 17, name: "Sangley Point" },
    { id: 18, name: "Science Garden" },
    { id: 19, name: "Sinait" },
    { id: 20, name: "Tanay" },
    { id: 21, name: "Tayabas" },
    { id: 22, name: "Tuguegarao" },
    { id: 23, name: "Virac" },
  ];

  return (
    <div className="relative w-50">
      <select
        onChange={(e) => onSelect?.(parseInt(e.target.value))}
        className="
          w-full cursor-pointer
          rounded-2xl border-2 border-[#B8BBC2]
          bg-white px-4.5 py-3.5 pr-11
          text-base font-medium text-text-primary
          appearance-none
          focus:outline-none focus:border-text-primary
        "
      >
        <option value="" disabled selected>Station</option>
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name}
          </option>
        ))}
      </select>

      <ChevronDownIcon
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-primary w-6 h-6"
      />
    </div>
  );
};

export default StationSelector;
