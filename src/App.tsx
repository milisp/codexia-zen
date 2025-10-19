import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatPage from "@/pages/chat";
import ProjectsPage from "@/pages/projects";
import Layout from "@/components/Layout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ProjectsPage />} />
          <Route path="chat" index element={<ChatPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
