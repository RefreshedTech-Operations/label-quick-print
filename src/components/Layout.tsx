import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Upload, List, Settings, Printer, LogOut, Package2, Monitor, MessageSquare, Users, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
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

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasMessagingRole, setHasMessagingRole] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [{ data: msgData }, { data: adminData }] = await Promise.all([
          supabase.rpc('has_role', { _user_id: user.id, _role: 'messaging' as any }),
          supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' as any }),
        ]);
        setHasMessagingRole(!!msgData);
        setIsAdmin(!!adminData);
      }
    })();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      navigate('/auth');
    }
  };

  const operationsItems = [
    { title: 'Scan', url: '/', icon: Package },
    { title: 'Upload', url: '/upload', icon: Upload },
    { title: 'All Orders', url: '/orders', icon: List },
    { title: 'Print Jobs', url: '/print-jobs', icon: Printer },
    { title: 'Batches', url: '/batches', icon: Package2 },
  ];

  const monitoringItems = [
    { title: 'TV Dashboard', url: '/tv-dashboard', icon: Monitor },
  ];

  const communicationItems = [
    { title: 'Messages', url: '/messages', icon: MessageSquare },
    { title: 'Customers', url: '/customers', icon: Users },
  ];

  const systemItems = [
    { title: 'Settings', url: '/settings', icon: Settings },
    ...(isAdmin ? [{ title: 'Admin', url: '/admin', icon: Shield }] : []),
  ];

  const renderMenuItems = (items: { title: string; url: string; icon: any }[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={item.url === '/' ? isActive('/') : location.pathname.startsWith(item.url)}
          tooltip={item.title}
        >
          <Link to={item.url}>
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarContent className="pt-2">
            <SidebarGroup>
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderMenuItems(operationsItems)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderMenuItems(monitoringItems)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {hasMessagingRole && (
              <SidebarGroup>
                <SidebarGroupLabel>Communication</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{renderMenuItems(communicationItems)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel>System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderMenuItems(systemItems)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
