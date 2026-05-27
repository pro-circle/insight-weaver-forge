import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import "./styles.css";

const qc = new QueryClient();

// Force light theme on every device — the app handles money and must look
// identical on mobile dark-mode browsers.
document.documentElement.classList.remove("dark");
document.documentElement.classList.add("light");
document.documentElement.style.colorScheme = "light";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster richColors position="top-right" theme="light" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
