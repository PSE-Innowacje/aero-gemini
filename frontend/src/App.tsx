import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/authStore";
import MainLayout from "@/components/MainLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import HelicoptersPage from "@/pages/HelicoptersPage";
import CrewPage from "@/pages/CrewPage";
import LandingSitesPage from "@/pages/LandingSitesPage";
import UsersPage from "@/pages/UsersPage";
import OperationsPage from "@/pages/OperationsPage";
import FlightOrdersPage from "@/pages/FlightOrdersPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/helicopters" element={<ProtectedRoute roles={['ADMIN']}><HelicoptersPage /></ProtectedRoute>} />
        <Route path="/crew" element={<ProtectedRoute roles={['ADMIN']}><CrewPage /></ProtectedRoute>} />
        <Route path="/landing-sites" element={<ProtectedRoute roles={['ADMIN']}><LandingSitesPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
        <Route path="/operations" element={<ProtectedRoute roles={['ADMIN', 'PLANNER', 'SUPERVISOR']}><OperationsPage /></ProtectedRoute>} />
        <Route path="/flight-orders" element={<ProtectedRoute roles={['ADMIN', 'SUPERVISOR', 'PILOT']}><FlightOrdersPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
