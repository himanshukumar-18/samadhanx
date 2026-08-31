export type UserRole =
  | 'community'
  | 'citizen'
  | 'student'
  | 'faculty'
  | 'university'
  | 'industry'
  | 'government'
  | 'ngo'
  | 'admin';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  iconName: string;
  badge?: string | number;
  highlight?: boolean;
}

export interface RoleConfig {
  role: UserRole;
  displayName: string;
  badgeColor: string;
  sidebarNav: NavItem[];
  mobileBottomNav: NavItem[];
  primaryActionLabel: string;
  primaryActionPath: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  headline: string;
  location: string;
  organization: string;
  skills: string[];
  interests: string[];
  stats: {
    problemsReported: number;
    teamsActive: number;
    solutionsDeployed: number;
    impactFollowers: number;
  };
}
