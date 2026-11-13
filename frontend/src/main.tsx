import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import AgentDetail from "./pages/AgentDetail";
import Agents from "./pages/Agents";
import Landing from "./pages/Landing";
import NewAssistant from "./pages/NewAssistant";
import Overview from "./pages/Overview";
import "./index.css";

// The dashboard is closed to the public for now: production builds send its
// pages back to the landing page. Local dev, or VITE_DASHBOARD=on, keeps it open.
const dashboardOpen = import.meta.env.DEV || import.meta.env.VITE_DASHBOARD === "on";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "*", element: <Navigate to="/" replace /> },
  {
    element: dashboardOpen ? <Layout /> : <Navigate to="/" replace />,
    children: [
      { path: "/dashboard", element: <Overview /> },
      { path: "/agents", element: <Agents /> },
      { path: "/agents/new", element: <NewAssistant /> },
      { path: "/agents/:id", element: <AgentDetail /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
