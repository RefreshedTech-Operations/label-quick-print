import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Upload, List, Settings, Printer, LogOut, Package2, Monitor, MessageSquare, Users, Shield, BarChart3, Truck, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAppStore } from '@/stores/useAppStore';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { title: 'Label', url: '/', icon: Package, group: 'Operations' },
  { title: 'Upload', url: '/upload', icon: Upload, group: 'Operations' },
  { title: 'All Orders', url: '/orders', icon: List, group: 'Operations' },
  { title: 'Print Jobs', url: '/print-jobs', icon: Printer, group: 'Operations' },
  { title: 'Pack', url: '/pack', icon: Package2, group: 'Operations' },
  { title: 'Shipping Labels', url: '/shipping-labels', icon: Truck, group: 'Operations' },
  { title: 'Sheet Prep', url: '/sheet-prep', icon: FileSpreadsheet, group: 'Operations' },
  { title: 'TV Dashboard', url: '/tv-dashboard', icon: Monitor, group: 'Monitoring' },
  { title: 'Pack TV Dashboard', url: '/pack-tv-dashboard', icon: Package2, group: 'Monitoring' },
  { title: 'Analytics', url: '/analytics', icon: BarChart3, group: 'Monitoring' },
  { title: 'Messages', url: '/messages', icon: MessageSquare, group: 'Communication' },
  { title: 'Customers', url: '/customers', icon: Users, group: 'Communication' },
  { title: 'Settings', url: '/settings', icon: Settings, group: 'System' },
  { title: 'Admin', url: '/admin', icon: Shield, group: 'System' },
];

const GROUPS = ['Operations', 'Monitoring', 'Communication', 'System'];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { allowedPages, permissionsLoaded, loadPermissions } = useAppStore();

  const isActive = (path: string) => 
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  useEffect(() => {
    loadPermissions();

    // Re-load permissions when auth state changes (e.g. session restored on mobile)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadPermissions(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadPermissions]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      navigate('/auth');
    }
  };

  // Filter nav items by permission
  const visibleItems = NAV_ITEMS.filter(item => allowedPages.has(item.url));

  const renderGroup = (groupName: string) => {
    const items = visibleItems.filter(i => i.group === groupName);
    if (items.length === 0) return null;

    return (
      <SidebarGroup key={groupName}>
        <SidebarGroupLabel>{groupName}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                >
                  <Link to={item.url}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarContent className="pt-2">
            {GROUPS.map(renderGroup)}
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 border-b bg-card flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Link to="/" className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold text-foreground">whatnot-labels</span>
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
