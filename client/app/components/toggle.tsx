import React, { useState } from "react";

interface ToggleProps {
  options: string[];
  onSelect?: (selected: string) => void;
}

const Toggle: React.FC<ToggleProps> = ({ options, onSelect }) => {
  const [selected, setSelected] = useState(options[0]);

  const handleSelect = (option: string) => {
    setSelected(option);
    onSelect?.(option);
  };

  return (
    <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => handleSelect(option)}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            selected === option
              ? "bg-white text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

export default Toggle;
