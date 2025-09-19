import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { enforceLovableOverlayPolicy } from "@/lib/lovable";

enforceLovableOverlayPolicy();

createRoot(document.getElementById("root")!).render(<App />);
