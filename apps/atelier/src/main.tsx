import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AtelierApp from "./AtelierApp";
import "./styles/tailwind.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <AtelierApp />
  </StrictMode>,
);
