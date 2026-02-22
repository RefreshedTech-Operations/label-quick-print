import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Upload, List, Settings, Printer, LogOut, Package2, Monitor, MessageSquare, Users, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">whatnot-labels</span>
            </Link>

            <nav className="flex items-center gap-2">
              <Button variant={isActive('/') ? 'default' : 'ghost'} asChild className="gap-2">
                <Link to="/"><Package className="h-4 w-4" />Scan</Link>
              </Button>
              
              <Button variant={isActive('/upload') ? 'default' : 'ghost'} asChild className="gap-2">
                <Link to="/upload"><Upload className="h-4 w-4" />Upload</Link>
              </Button>

              <Button variant={isActive('/orders') ? 'default' : 'ghost'} asChild className="gap-2">
                <Link to="/orders"><List className="h-4 w-4" />All Orders</Link>
              </Button>

              <Button variant={isActive('/print-jobs') ? 'default' : 'ghost'} asChild className="gap-2">
                <Link to="/print-jobs"><Printer className="h-4 w-4" />Print Jobs</Link>
              </Button>

              <Button variant={isActive('/batches') ? 'default' : 'ghost'} asChild className="gap-2">
                <Link to="/batches"><Package2 className="h-4 w-4" />Batches</Link>
              </Button>

              <Button variant={isActive('/tv-dashboard') ? 'default' : 'ghost'} asChild className="gap-2">
                <Link to="/tv-dashboard"><Monitor className="h-4 w-4" />TV Dashboard</Link>
              </Button>

              {hasMessagingRole && (
                <>
                  <Button variant={isActive('/messages') ? 'default' : 'ghost'} asChild className="gap-2">
                    <Link to="/messages"><MessageSquare className="h-4 w-4" />Messages</Link>
                  </Button>
                  <Button variant={isActive('/customers') || location.pathname.startsWith('/customers/') ? 'default' : 'ghost'} asChild className="gap-2">
                    <Link to="/customers"><Users className="h-4 w-4" />Customers</Link>
                  </Button>
                </>
              )}

              {isAdmin && (
                <Button variant={isActive('/admin') ? 'default' : 'ghost'} asChild className="gap-2">
                  <Link to="/admin"><Shield className="h-4 w-4" />Admin</Link>
                </Button>
              )}

              <Button variant={isActive('/settings') ? 'default' : 'ghost'} asChild className="gap-2">
                <Link to="/settings"><Settings className="h-4 w-4" />Settings</Link>
              </Button>

              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
