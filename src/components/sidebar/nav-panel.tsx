"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Channel, matchesPath } from "@/lib/nav";
import { useNavBadges } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function NavPanel({
  channel,
  onNavigate,
}: {
  channel: Channel;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const badges = useNavBadges();

  return (
    <div className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-4">
        <span className="text-lg font-semibold tracking-tight">
          Vet<span className="text-primary">Data</span>
        </span>
      </div>
      <div className="px-3 pt-4 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {channel.title}
      </div>
      <nav className="flex flex-col gap-0.5 px-2" aria-label={channel.title}>
        {channel.items.map((item) => {
          const Icon = item.icon;
          const active = matchesPath(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.title}
              {badges[item.href] > 0 && (
                <span className="ml-auto rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary tabular-nums">
                  {badges[item.href]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
