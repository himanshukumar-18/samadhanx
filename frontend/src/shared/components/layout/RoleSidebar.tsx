import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore, Language } from '../../../store/languageStore';
import { getRoleConfig } from '../../../config/roles';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { notificationsApi } from '../../../api/notifications';
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

const getNavLabel = (item: { id: string; label: string }, lang: Language): string => {
  if (lang === 'en') return item.label;
  const map: Record<string, string> = {
    home: 'होम फीड',
    explore: 'समस्याएं खोजें',
    nearby: 'आस-पास के मुद्दे',
    saved: 'सहेजी गई समस्याएं',
    notifications: 'सूचनाएं',
    profile: 'मेरी प्रोफ़ाइल',
    'my-problems': 'मेरी समस्याएं',
    'my-teams': 'मेरी टीमें',
    projects: 'प्रोजेक्ट्स',
    'discover-people': 'साथी खोजें',
    mentoring: 'मेंटरिंग पॉड्स',
    'student-teams': 'छात्र टीमें',
    research: 'अनुसंधान एवं अनुदान',
    impact: 'प्रभाव',
  };
  return map[item.id] || item.label;
};

export const RoleSidebar: React.FC<{ currentPath?: string; onItemClick?: () => void }> = ({
  currentPath = window.location.pathname,
  onItemClick,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const { language } = useLanguageStore();
  const activeRole = user?.role || 'citizen';
  const config = getRoleConfig(activeRole);

  const { data: notifications } = useQuery({
    queryKey: ['unread-notifications-count'],
    queryFn: () => notificationsApi.listNotifications(15),
    enabled: isAuthenticated,
  });

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.is_read).length
    : 0;

  const handlePrimaryAction = () => {
    if (window.location.pathname === '/' || window.location.pathname === config.primaryActionPath) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.href = config.primaryActionPath;
    }
    if (onItemClick) onItemClick();
  };

  const isUploadButton = config.primaryActionLabel === 'Upload';

  return (
    <aside className="w-full h-full flex flex-col justify-between py-2 px-1 space-y-4 select-none">
      <div className="space-y-3.5">
        {/* Workspace Card */}
        <div className="p-3.5 bg-card rounded-2xl border border-border flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
              {language === 'hi' ? 'कार्यक्षेत्र' : 'Workspace'}
            </span>
            <span className="text-sm font-black text-foreground truncate">
              {language === 'hi' ? 'नागरिक / समुदाय' : config.displayName}
            </span>
          </div>
          <Badge variant="student" className="text-[10px] px-2 py-0.5 uppercase tracking-wider flex-shrink-0">
            {activeRole}
          </Badge>
        </div>

        {/* Primary Action Button */}
        {!isUploadButton && config.primaryActionLabel && (
          <Button
            variant="primary"
            size="sm"
            className="w-full h-11 rounded-xl text-sm font-bold shadow-xs"
            onClick={handlePrimaryAction}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            {config.primaryActionLabel}
          </Button>
        )}

        {/* Navigation List */}
        <nav className="space-y-1" aria-label="Main Navigation">
          {config.sidebarNav.map((item) => {
            const IconComponent = ICON_MAP[item.iconName] || Home;
            const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
            const badgeValue = item.id === 'notifications'
              ? (unreadCount > 0 ? String(unreadCount) : null)
              : item.badge;
            const displayLabel = getNavLabel(item, language);

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
                  <span className="truncate">{displayLabel}</span>
                </div>
                {badgeValue && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${
                    badgeValue === 'NEW' ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'
                  }`}>
                    {badgeValue}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Production Product Footer */}
      <div className="pt-3 border-t border-border text-xs text-muted-foreground text-center space-y-0.5">
        <p className="font-bold text-foreground">SamadhanX</p>
        <p className="text-[11px] text-muted-foreground">© 2026 SamadhanX. All rights reserved.</p>
      </div>
    </aside>
  );
};
