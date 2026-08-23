import "./globals.css";
import Nav from "./nav";

export const metadata = {
  title: "AzTest — Azərbaycan dili üzrə LLM benchmark",
  description: "Dil modellərinin Azərbaycan dilində yazı keyfiyyətinin ölçülməsi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="az">
      <body>
        <Nav />
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
