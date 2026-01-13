import { Calendar } from "lucide-react";
import { useRef } from "react";

interface DateSelectorProps {
  onSelect?: (date: string) => void;
  value?: string;
}

const DateSelector: React.FC<DateSelectorProps> = ({ onSelect, value }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    inputRef.current?.showPicker?.();
    inputRef.current?.focus();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect?.(e.target.value);
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-50 cursor-pointer"
    >
      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        onChange={handleDateChange}
        className="
          w-full cursor-pointer
          rounded-2xl border-2 border-[#B8BBC2]
          bg-white px-4.5 py-3.5 pr-11
          text-base font-medium text-text-primary
          appearance-none
          focus:outline-none focus:border-text-primary
          [&::-webkit-calendar-picker-indicator]:opacity-0
        "
      />

      <Calendar
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-primary w-5 h-5"
      />
    </div>
  );
};

export default DateSelector;
