import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCodexStore } from "@/stores/useCodexStore";
import { Share } from "lucide-react";
import { Badge } from "./ui/badge";

interface TopNavProps extends React.HTMLAttributes<HTMLElement> {
  items: { href: string; title: string }[];
}

export function TopNav({ className, items, ...props }: TopNavProps) {
  const location = useLocation();
  const { cwd } = useCodexStore();

  return (
    <div className="flex justify-between">
      <nav
        className={cn("flex items-center space-x-1 lg:space-x-1", className)}
        {...props}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              location.pathname === item.href
                ? "bg-muted hover:bg-muted"
                : "hover:bg-transparent hover:underline",
              "justify-start",
            )}
          >
            {item.title}
          </Link>
        ))}
      </nav>

      {cwd && (
        <Badge>{cwd}</Badge>
      )}
      <Button variant="outline" size="icon">
        <Share />
      </Button>
    </div>
  );
}
