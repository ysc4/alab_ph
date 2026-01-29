import { Calendar } from "lucide-react";
import { useRef } from "react";

interface DateSelectorProps {
  onSelect?: (date: string) => void;
  value?: string;
}

const DateSelector: React.FC<DateSelectorProps> = ({ onSelect, value }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect?.(e.target.value);
  };

  return (
    <div className="relative w-50">
      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        onChange={handleDateChange}
        min="2023-03-01"
        max="2023-05-31"
        readOnly
        className="
          w-full cursor-pointer
          rounded-2xl border-2 border-[#B8BBC2]
          bg-white px-4.5 py-3.5 pr-11
          text-base font-medium text-text-primary
          appearance-none
          focus:outline-none focus:border-text-primary
          [&::-webkit-calendar-picker-indicator]:cursor-pointer
        "
      />
      <Calendar
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-primary w-5 h-5"
      />
    </div>
  );
};

export default DateSelector;