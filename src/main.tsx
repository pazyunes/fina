
  // Primero, antes que la app: corrige la dirección si se llegó desde el link
  // del mail de recuperación (ver desvioRecuperacion.ts).
  import "./app/desvioRecuperacion";
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);
  