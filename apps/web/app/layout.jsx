import "./globals.css";
import Nav from "./nav";
import { LangProvider } from "@/lib/i18n";

export const metadata = {
  title: "AzTest — Azerbaijani LLM writing benchmark",
  description: "Measuring how well language models write Azerbaijani",
};

export default function RootLayout({ children }) {
  // lang is corrected on the client by LangProvider once the stored choice is
  // known; az is the default because most reviewers work in Azerbaijani.
  return (
    <html lang="az">
      <body>
        <LangProvider>
          <Nav />
          <div className="page">{children}</div>
        </LangProvider>
      </body>
    </html>
  );
}
