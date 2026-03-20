import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShredCater | Admin Dashboard",
  description: "Advanced Catering Order Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex overflow-hidden`}>
        <Sidebar username="PadPad" />
        <main className="flex-1 h-screen overflow-y-auto bg-black bg-opacity-50">
          <div className="p-8 pb-20">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
