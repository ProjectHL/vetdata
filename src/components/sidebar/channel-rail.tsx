"use client";

import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { channels } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function ChannelRail({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-2 border-r bg-sidebar py-3">
      <Link href="/dashboard" aria-label="VetData" className="mb-2">
        <LogoMark />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1" aria-label="Canales">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const active = channel.id === activeId;
          return (
            <Tooltip key={channel.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(channel.id)}
                  aria-label={channel.title}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                  )}
                >
                  <Icon className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{channel.title}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );
}
