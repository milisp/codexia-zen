import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import ChatPage from "@/pages/chat";
import ProjectsPage from "@/pages/projects";
import Layout from "@/components/Layout";
import { useEffect } from "react";
import { usePageStore } from "@/stores/usePageStore";

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPage } = usePageStore();

  useEffect(() => {
    if (location.pathname === "/" && currentPage !== "/") {
      navigate(currentPage, { replace: true });
    }
  }, [currentPage, location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<ProjectsPage />} />
        <Route path="chat" index element={<ChatPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
