import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Plane, Users, MapPin, UserCog, ClipboardList, FileText } from 'lucide-react';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const adminItems: NavItem[] = [
  { title: 'Helikoptery', url: '/helicopters', icon: Plane, roles: ['ADMIN'] },
  { title: 'Załoga', url: '/crew', icon: Users, roles: ['ADMIN'] },
  { title: 'Lądowiska', url: '/landing-sites', icon: MapPin, roles: ['ADMIN'] },
  { title: 'Użytkownicy', url: '/users', icon: UserCog, roles: ['ADMIN'] },
];

const planningItems: NavItem[] = [
  { title: 'Planowane operacje', url: '/operations', icon: ClipboardList, roles: ['ADMIN', 'PLANNER', 'SUPERVISOR'] },
];

const orderItems: NavItem[] = [
  { title: 'Zlecenia na lot', url: '/flight-orders', icon: FileText, roles: ['ADMIN', 'SUPERVISOR', 'PILOT'] },
];

const AppSidebar: React.FC = () => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user } = useAuthStore();
  const location = useLocation();

  const filterByRole = (items: NavItem[]) =>
    items.filter(i => user && i.roles.includes(user.role));

  const renderGroup = (label: string, items: NavItem[]) => {
    const filtered = filterByRole(items);
    if (filtered.length === 0) return null;
    return (
      <SidebarGroup key={label}>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {filtered.map(item => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end
                    className="hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4">
          <Link to="/" className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-sidebar-primary shrink-0" />
            {!collapsed && <h2 className="text-lg font-bold text-sidebar-foreground hover:text-sidebar-primary transition-colors">HeliOps Aero</h2>}
          </Link>
        </div>
        {renderGroup('Administracja', adminItems)}
        {renderGroup('Planowanie operacji', planningItems)}
        {renderGroup('Zlecenia na lot', orderItems)}
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
