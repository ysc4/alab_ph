import { ChevronDown } from "lucide-react";

interface ClassificationSelectorProps {
  onSelect?: (selected: string) => void;
}

const ClassificationSelector: React.FC<ClassificationSelectorProps> = ({ onSelect }) => {
  return (
    <div className="relative w-50">
      <select
        onChange={(e) => onSelect?.(e.target.value)}
        defaultValue=""
        className="
          w-full cursor-pointer
          rounded-2xl border-2 border-[#B8BBC2]
          bg-white px-4 py-3 pr-11
          text-base font-medium text-text-primary
          appearance-none
          focus:outline-none focus:border-text-primary
        "
      >
        <option value="">All Classifications</option>
        <option value="Caution">Caution</option>
        <option value="Extreme Caution">Extreme Caution</option>
        <option value="Danger">Danger</option>
        <option value="Extreme Danger">Extreme Danger</option>
      </select>

      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-primary w-6 h-6"
      />
    </div>
  );
};

export default ClassificationSelector;
