import ReactDOM from "react-dom/client";
import App from "./App";
import { Toaster } from "sonner";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <div>
    <App />
    <Toaster />
  </div>,
);
