const config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1666BA",
        "accent-hover": "#368CE7",
        "accent-1": "#7AB3EF",
        "accent-2": "#BEDAF7",
        "accent-3": "#DEECFB",

        "bg-main": "#E9EBF0",

        "text-primary": "#1E1E1E",
        "text-muted": "#666666",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
