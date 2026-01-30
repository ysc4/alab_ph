import React from "react";

interface GlobalLoaderProps {
  isLoading: boolean;
}

const GlobalLoader: React.FC<GlobalLoaderProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />

        {/* Optional text */}
        <p className="text-sm text-white tracking-wide">
          Loading, please wait...
        </p>
      </div>
    </div>
  );
};

export default GlobalLoader;
