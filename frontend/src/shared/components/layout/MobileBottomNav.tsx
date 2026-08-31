import React from 'react';
import { useAuthStore } from '../../../store/authStore';
import { getRoleConfig } from '../../../config/roles';
import { 
  Home, 
  Compass, 
  MapPin, 
  PlusCircle, 
  Bookmark, 
  User, 
  Users, 
  GraduationCap, 
  Layers, 
  Building2, 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  TrendingUp, 
  History
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Home,
  Compass,
  MapPin,
  PlusCircle,
  Bookmark,
  User,
  Users,
  GraduationCap,
  Layers,
  Building2,
  Search,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  History,
};

export const MobileBottomNav: React.FC = () => {
  const { user } = useAuthStore();
  const activeRole = user?.role || 'citizen';
  const config = getRoleConfig(activeRole);
  const currentPath = window.location.pathname;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 border-t border-border backdrop-blur-lg px-3 py-1 h-16 flex items-center justify-around shadow-lg">
      {config.mobileBottomNav.map((item) => {
        const Icon = ICON_MAP[item.iconName] || Home;
        const isActive = currentPath === item.path;

        if (item.highlight) {
          return (
            <a
              key={item.id}
              href={item.path}
              className="flex flex-col items-center justify-center -mt-6 group min-w-[56px] min-h-[56px]"
              aria-label={item.label}
            >
              <div className="w-13 h-13 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/35 border-4 border-card group-hover:scale-105 transition-transform">
                <PlusCircle className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-primary mt-0.5">{item.label}</span>
            </a>
          );
        }

        return (
          <a
            key={item.id}
            href={item.path}
            className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] rounded-xl transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[11px] font-medium mt-0.5">{item.label}</span>
          </a>
        );
      })}
    </div>
  );
};
