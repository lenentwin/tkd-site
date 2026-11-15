import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { ContentProvider } from "./app/providers/ContentProvider";
import { ThemeProvider } from "./app/providers/ThemeProvider";
import { AuthProvider } from "./app/providers/AuthProvider";
import { initializePwa } from "./pwa/runtime";
import { PwaStatus } from "./pwa/PwaControls";
import "./styles/global.css";
import "./app/demo.css";

initializePwa();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ContentProvider>
        <ThemeProvider>
          <AuthProvider>
            <App />
            <PwaStatus />
          </AuthProvider>
        </ThemeProvider>
      </ContentProvider>
    </BrowserRouter>
  </StrictMode>,
);
