
  // Primero, antes que la app: corrige la dirección si se llegó desde el link
  // del mail de recuperación (ver desvioRecuperacion.ts).
  import "./app/desvioRecuperacion";
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { registrarServiceWorker } from "./app/api/v2/notificaciones";

  createRoot(document.getElementById("root")!).render(<App />);

  // Para las notificaciones de la app (public/sw.js).
  registrarServiceWorker();
  