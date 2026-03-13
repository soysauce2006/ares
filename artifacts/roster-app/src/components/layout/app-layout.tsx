import React, { useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Users,
  Activity,
  Crosshair,
  Medal,
  LayoutDashboard,
  Settings,
  LogOut,
  User as UserIcon,
  Building2,
  Layers,
} from "lucide-react";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/settings-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const settings = useSettings();

  const { data: user, isLoading, isError } = useGetCurrentUser({ query: { retry: 1 } });

  const { mutate: logout } = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
        setLocation("/login");
        toast({ title: "Logged out successfully" });
      },
    },
  });

  useEffect(() => {
    if (!isLoading && (isError || !user)) setLocation("/login");
  }, [isLoading, isError, user, setLocation]);

  useEffect(() => {
    if (!isLoading && user && (user as any).mustChangePassword && location !== "/change-password") {
      setLocation("/change-password");
    }
  }, [isLoading, user, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Shield className="w-12 h-12 text-primary animate-pulse" />
          <h2 className="text-xl font-display text-primary uppercase tracking-widest">Initializing Secure Connection...</h2>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = (user as any).role === "admin";
  const isManagerOrAdmin = isAdmin || (user as any).role === "manager";

  const mainNav = [
    { title: "Command Center", href: "/", icon: LayoutDashboard },
    { title: "Roster", href: "/roster", icon: Users },
    { title: "Ranks", href: "/ranks", icon: Medal },
  ];

  const orgNav = [
    { title: settings.tier1LabelPlural, href: "/divisions", icon: Building2 },
    { title: settings.tier2LabelPlural, href: "/units", icon: Layers },
    { title: settings.tier3LabelPlural, href: "/squads", icon: Crosshair },
  ];

  const adminNav = [
    { title: "Clearance Ranks", href: "/clearances", icon: Shield },
    { title: "Personnel Auth", href: "/users", icon: Users },
    { title: "Activity Log", href: "/activity", icon: Activity },
    { title: "System Config", href: "/settings", icon: Settings },
  ];

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background bg-grid-pattern overflow-hidden">
        <Sidebar variant="sidebar" className="border-r border-border/50 bg-sidebar/95 backdrop-blur-xl">
          <SidebarHeader className="border-b border-border/50 p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/20 p-2 rounded-lg border border-primary/30 shadow-[0_0_15px_rgba(218,165,32,0.15)]">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-lg leading-none tracking-wider text-foreground">{settings.siteName}</span>
                <span className="text-[10px] uppercase tracking-widest text-primary font-mono">{settings.siteSubtitle}</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-2 space-y-4 mt-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-mono text-muted-foreground uppercase tracking-widest px-2 mb-2">Main Directives</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="flex items-center gap-3 font-medium transition-all group">
                          <item.icon className="w-4 h-4 group-data-[active=true]:text-primary" />
                          <span className="uppercase tracking-wide font-display text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-mono text-muted-foreground uppercase tracking-widest px-2 mb-2">Organization</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {orgNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="flex items-center gap-3 font-medium transition-all group">
                          <item.icon className="w-4 h-4 group-data-[active=true]:text-primary" />
                          <span className="uppercase tracking-wide font-display text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-mono text-muted-foreground uppercase tracking-widest px-2 mb-2">Clearance Level: Alpha</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNav.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={location === item.href}>
                          <Link href={item.href} className="flex items-center gap-3 font-medium transition-all group">
                            <item.icon className="w-4 h-4 group-data-[active=true]:text-primary" />
                            <span className="uppercase tracking-wide font-display text-sm">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-border/50 p-4 bg-black/20">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold font-display uppercase">{(user as any).username}</span>
                    <span className="text-[10px] text-primary font-mono capitalize">{(user as any).role}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="w-full text-xs uppercase font-display tracking-widest border-border/50 hover:border-primary/50 hover:text-primary transition-colors" asChild>
                  <Link href="/profile">Profile</Link>
                </Button>
                <Button variant="ghost" size="icon" className="shrink-0 hover:bg-destructive/20 hover:text-destructive transition-colors" onClick={() => logout()}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-secondary/80 transition-colors" />
              <div className="hidden md:flex items-center gap-2 text-sm font-mono text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                SYSTEM ONLINE // SECURE CONNECTION ESTABLISHED
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
              {new Date().toISOString().split("T")[0]} // {new Date().toISOString().split("T")[1].substring(0, 5)} Z
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto w-full max-w-[1600px] mx-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
