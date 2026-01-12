import React, { JSX, ForwardRefExoticComponent, RefAttributes } from "react";
import { HomeIcon, MapIcon, SignalIcon } from "@heroicons/react/24/outline";
import { SVGProps } from "react";

type IconComponent = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, "ref"> & {
    title?: string;
    titleId?: string;
  } & RefAttributes<SVGSVGElement>
>;

type PageKey = "Home" | "Map" | "Station";

interface SidebarProps {
  activePage: PageKey;
  onPageChange: (page: PageKey) => void;
}

interface MenuItem {
  name: PageKey;
  icon: IconComponent;
}

const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onPageChange,
}) => {
  const menuItems: MenuItem[] = [
    { name: "Home", icon: HomeIcon },
    { name: "Map", icon: MapIcon },
    { name: "Station", icon: SignalIcon },
  ];

  return (
    <aside className="w-65 h-screen bg-white text-primary flex flex-col px-4 py-6 shrink-0">
      <div className="text-center text-4xl font-semibold mb-12">
        SOLA
      </div>

      <nav className="flex flex-col gap-3">
        {menuItems.map((item) => {
          const isActive = activePage === item.name;

          return (
            <button
              key={item.name}
              onClick={() => onPageChange(item.name)}
              className={`
                flex items-center gap-2
                px-3.5 py-2.5
                rounded-full text-left text-lg
                transition-colors duration-200
                ${
                  isActive
                    ? "bg-primary text-white font-semibold"
                    : "text-text-muted hover:bg-primary hover:text-white"
                }
              `}
            >
              <item.icon className="w-6 h-6 shrink-0" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
