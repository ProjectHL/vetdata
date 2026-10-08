import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Topbar } from "@/components/topbar";
import { RetailProvider } from "@/lib/retail-store";
import { SecurityProvider } from "@/lib/security-store";
import { StoreProvider } from "@/lib/store";
import { SupportProvider } from "@/lib/support-store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <RetailProvider>
        <SupportProvider>
          <SecurityProvider>
            <div className="flex min-h-svh">
              <aside className="sticky top-0 hidden h-svh lg:block">
                <AppSidebar />
              </aside>
              <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
                <Topbar />
                <main className="flex-1 p-4 sm:p-6">{children}</main>
              </div>
            </div>
          </SecurityProvider>
        </SupportProvider>
      </RetailProvider>
    </StoreProvider>
  );
}
