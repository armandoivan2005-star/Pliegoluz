import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationLoadingOverlay } from "@/components/navigation-loading-overlay";
import "./globals.css";

const themeBootstrapScript = `(function(){try{var key="pliegoluz-theme";var saved=localStorage.getItem(key);var theme=saved==="light"||saved==="dark"?saved:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch(e){document.documentElement.dataset.theme="dark"}})();`;

export const metadata: Metadata = {
  title: {
    default: "Pliegoluz — Biblioteca digital",
    template: "%s | Pliegoluz",
  },
  description: "Lee Casa Reykov en una experiencia digital serena, adaptable y sin distracciones.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full">
        {children}
        <Suspense fallback={null}>
          <NavigationLoadingOverlay />
        </Suspense>
      </body>
    </html>
  );
}
