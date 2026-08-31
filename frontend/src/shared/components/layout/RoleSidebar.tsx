import React from 'react';
import { useAuthStore } from '../../../store/authStore';
import { getRoleConfig } from '../../../config/roles';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  Home, 
  Compass, 
  MapPin, 
  PlusCircle, 
  Bookmark, 
  Bell, 
  User, 
  Lightbulb, 
  Users, 
  FolderGit2, 
  UserPlus, 
  Sparkles, 
  GraduationCap, 
  BookOpen, 
  TrendingUp, 
  Layers, 
  Building2, 
  Award, 
  Search, 
  Rocket, 
  ShieldCheck, 
  Landmark, 
  CheckCircle2, 
  FileText, 
  History, 
  BarChart3
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Home,
  Compass,
  MapPin,
  PlusCircle,
  Bookmark,
  Bell,
  User,
  Lightbulb,
  Users,
  FolderGit2,
  UserPlus,
  Sparkles,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Layers,
  Building2,
  Award,
  Search,
  Rocket,
  ShieldCheck,
  Landmark,
  CheckCircle2,
  FileText,
  History,
  BarChart3,
};

export const RoleSidebar: React.FC<{ currentPath?: string; onItemClick?: () => void }> = ({
  currentPath = window.location.pathname,
  onItemClick,
}) => {
  const { user } = useAuthStore();
  const activeRole = user?.role || 'citizen';
  const config = getRoleConfig(activeRole);

  return (
    <aside className="w-full h-full flex flex-col justify-between py-2 px-1 space-y-4">
      <div className="space-y-3.5">
        {/* Real Workspace Card */}
        <div className="p-3.5 bg-muted/60 rounded-2xl border border-border flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider truncate">Workspace</span>
            <span className="text-sm font-black text-foreground truncate">{config.displayName}</span>
          </div>
          <Badge variant="student" className="text-[10px] px-2 py-0.5 uppercase tracking-wider flex-shrink-0">
            {activeRole}
          </Badge>
        </div>

        {/* Primary Action Button */}
        <Button
          variant="primary"
          size="sm"
          className="w-full h-11 rounded-xl shadow-md shadow-primary/20 text-sm font-bold"
          onClick={() => {
            window.location.href = config.primaryActionPath;
            if (onItemClick) onItemClick();
          }}
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          {config.primaryActionLabel}
        </Button>

        {/* Navigation List */}
        <nav className="space-y-1" aria-label="Main Navigation">
          {config.sidebarNav.map((item) => {
            const IconComponent = ICON_MAP[item.iconName] || Home;
            const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));

            return (
              <a
                key={item.id}
                href={item.path}
                onClick={() => {
                  if (onItemClick) onItemClick();
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                } ${item.highlight ? 'ring-1 ring-primary/30 text-primary' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <IconComponent className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${
                    item.badge === 'NEW' ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Clean Production Product Footer */}
      <div className="pt-3 border-t border-border text-xs text-muted-foreground text-center space-y-0.5">
        <p className="font-semibold text-foreground">SamadhanX</p>
        <p className="text-[11px] text-muted-foreground">© 2026 SamadhanX</p>
      </div>
    </aside>
  );
};
