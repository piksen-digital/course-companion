import type { Metadata } from "next";
import "./globals.css"; // Ensure you have a tailwind-enabled globals.css

export const metadata: Metadata = {
  title: "Whop AI Companion",
  description: "Your course's intelligent tutor.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
