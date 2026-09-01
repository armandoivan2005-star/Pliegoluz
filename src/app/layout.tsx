import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pliegoluz — Biblioteca digital",
    template: "%s | Pliegoluz",
  },
  description: "Lee Casa Reykov en una experiencia digital serena, adaptable y sin distracciones.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
