import { Outlet, useLocation } from "react-router-dom";
import { TopNav } from "@/components/top-nav";
import { useEffect } from "react";
import { usePageStore } from "@/stores/usePageStore";

const navItems = [
  { title: "Projects", href: "/" },
  { title: "Chat", href: "/chat" },
];

export default function Layout() {
  const location = useLocation();
  const { setCurrentPage } = usePageStore();

  useEffect(() => {
    setCurrentPage(location.pathname);
  }, [location.pathname, setCurrentPage]);

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b px-2">
        <TopNav items={navItems} />
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
