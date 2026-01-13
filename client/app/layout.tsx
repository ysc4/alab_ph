import type { Metadata } from "next";
import React, { ReactNode } from "react";
import "./globals.css";
import { Poppins } from "next/font/google";

// Load Poppins with all weights
const poppins = Poppins({
  weight: ["100","200","300","400","500","600","700","800","900"],
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Alab-PH",
  description: "A web dashboard for heat index forecasting in the Philippines",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
