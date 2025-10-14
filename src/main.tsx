import ReactDOM from "react-dom/client";
import App from "./App";
import { Toaster } from "sonner";
import React from "react";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);
