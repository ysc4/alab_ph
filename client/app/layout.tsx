import type { Metadata } from "next";
import React, { ReactNode } from "react";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
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
    <html lang="en" className={inter.variable}>
      <body className="relative">
        {children}
      </body>
    </html>
  );
}
