import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/features/operations/theme-toggle";

export const metadata: Metadata = {
  title: "ForgeOps | Alarm & Maintenance",
  description: "Factory automation operations dashboard",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/*
          Apply the stored theme before the first paint. Without this the page
          renders in light mode first and then flips, which is visible as a
          flash on every navigation.

          The stored value is one of "light", "dark" or "system", matching
          THEME_OPTIONS in theme-toggle.tsx. "system" follows the operating
          system, which is also the default when nothing has been chosen yet.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("forgeops-theme");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-canvas font-sans text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
