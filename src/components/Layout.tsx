import { Outlet } from "react-router-dom";
import { TopNav } from "@/components/top-nav";

const navItems = [
  { title: "Projects", href: "/" },
  { title: "Chat", href: "/chat" },
];

export default function Layout() {
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
