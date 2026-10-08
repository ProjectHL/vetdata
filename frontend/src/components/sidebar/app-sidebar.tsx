"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { channels, findByPath } from "@/lib/nav";
import { ChannelRail } from "./channel-rail";
import { NavPanel } from "./nav-panel";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const routeChannelId = findByPath(pathname).channel.id;
  const [selected, setSelected] = useState({ id: routeChannelId, path: pathname });

  // Al cambiar de ruta, el canal activo vuelve a ser el de la ruta.
  const activeId = selected.path === pathname ? selected.id : routeChannelId;
  const channel = channels.find((c) => c.id === activeId) ?? channels[0];

  return (
    <div className="flex h-full">
      <ChannelRail
        activeId={activeId}
        onSelect={(id) => setSelected({ id, path: pathname })}
      />
      <NavPanel channel={channel} onNavigate={onNavigate} />
    </div>
  );
}
