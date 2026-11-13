import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import AgentDetail from "./pages/AgentDetail";
import Agents from "./pages/Agents";
import Landing from "./pages/Landing";
import NewAssistant from "./pages/NewAssistant";
import Overview from "./pages/Overview";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  {
    element: <Layout />,
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
