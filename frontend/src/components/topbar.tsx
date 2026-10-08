"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Eye, LifeBuoy, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { Logo } from "@/components/logo";
import { CommandPalette, SearchTrigger, useCommandPaletteShortcut } from "@/components/search/command-palette";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { NewTicketDialog, moduleLabel } from "@/components/support/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { currentClinic } from "@/lib/lookups";
import { ROLES, type Role } from "@/domain/settings";
import { findByPath } from "@/lib/nav";
import { useStore } from "@/lib/store";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [searching, setSearching] = useState(false);
  const openSearch = useCallback(() => setSearching(true), []);
  useCommandPaletteShortcut(openSearch);
  const pathname = usePathname();
  const { channel, item } = findByPath(pathname);
  const { requests, role, setRole, currentUser, sharingPolicy } = useStore();
  const pending = sharingPolicy.notifyRequests
    ? requests.filter((r) => r.to === currentClinic && r.status === "Pendiente").length
    : 0;
  const initials = currentUser.name
    .replace(/^(Dra?\.)\s/, "")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-auto p-0 sm:max-w-none" showCloseButton={false}>
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <AppSidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Logo className="lg:hidden" />

      <div className="hidden min-w-0 text-sm text-muted-foreground lg:block">
        {channel.title}
        {item && (
          <>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">{item.title}</span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <SearchTrigger onOpen={openSearch} />
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buscar" onClick={openSearch}>
          <Search />
        </Button>
        <CommandPalette open={searching} onOpenChange={setSearching} />
        <Button variant="ghost" size="icon" className="relative" aria-label={`Solicitudes pendientes: ${pending}`} asChild>
          <Link href="/clinicas/solicitudes">
            <Bell />
            {pending > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
                {pending}
              </span>
            )}
          </Link>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Reportar un problema a VetData" onClick={() => setReporting(true)}>
              <LifeBuoy />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reportar un problema a VetData</TooltipContent>
        </Tooltip>
        <NewTicketDialog
          open={reporting}
          onOpenChange={setReporting}
          defaultModule={item ? moduleLabel(channel.title, item.title) : undefined}
          route={pathname}
        />
        <Badge variant="outline" className="hidden sm:inline-flex" title="Rol con el que estás viendo el prototipo">
          <Eye /> {role}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-full" aria-label="Cuenta">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{currentUser.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{currentUser.role} · {currentClinic}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Ver como (demo de roles)</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
              {ROLES.map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>{r}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/ajustes/perfil"><User /> Perfil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/ajustes/permisos"><Settings /> Roles y permisos</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/login"><LogOut /> Cerrar sesión</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
