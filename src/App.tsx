import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Upload from "./pages/Upload";
import Orders from "./pages/Orders";
import PrintJobs from "./pages/PrintJobs";
import Settings from "./pages/Settings";
import Pack from "./pages/Pack";
import AdminTools from "./pages/AdminTools";
import TVDashboard from "./pages/TVDashboard";
import Analytics from "./pages/Analytics";
import Messages from "./pages/Messages";
import Customers from "./pages/Customers";
import CustomerProfile from "./pages/CustomerProfile";
import ShippingLabels from "./pages/ShippingLabels";
import SheetPrep from "./pages/SheetPrep";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="whatnot-labels-theme" attribute="class">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Index />} />
            <Route path="/upload" element={<Layout><Upload /></Layout>} />
            <Route path="/orders" element={<Layout><Orders /></Layout>} />
            <Route path="/print-jobs" element={<Layout><PrintJobs /></Layout>} />
            <Route path="/pack" element={<Layout><Pack /></Layout>} />
            <Route path="/tv-dashboard" element={<TVDashboard />} />
            <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="/admin" element={<Layout><AdminTools /></Layout>} />
            <Route path="/messages" element={<Layout><Messages /></Layout>} />
            <Route path="/customers" element={<Layout><Customers /></Layout>} />
            <Route path="/shipping-labels" element={<Layout><ShippingLabels /></Layout>} />
            <Route path="/sheet-prep" element={<Layout><SheetPrep /></Layout>} />
            <Route path="/customers/:id" element={<Layout><CustomerProfile /></Layout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
