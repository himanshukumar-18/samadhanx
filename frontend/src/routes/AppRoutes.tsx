import React from 'react';
import { MainLayout } from '../shared/components/layout/MainLayout';
import { FeedPage } from '../modules/feed/pages/FeedPage';
import { ProblemDetailPage } from '../modules/feed/pages/ProblemDetailPage';
import { ProfilePage } from '../modules/profile/pages/ProfilePage';
import { PublicProfilePage } from '../modules/profile/pages/PublicProfilePage';
import { SettingsPage } from '../modules/profile/pages/SettingsPage';
import { CitizenDashboard } from '../modules/citizen/pages/CitizenDashboard';
import { StudentDashboard } from '../modules/student/pages/StudentDashboard';
import { ProjectsPage } from '../modules/student/pages/ProjectsPage';
import { ProjectWorkspacePage } from '../modules/student/pages/ProjectWorkspacePage';
import { DiscoverPeoplePage } from '../modules/student/pages/DiscoverPeoplePage';
import { ExplorePage } from '../modules/explore/pages/ExplorePage';
import { TeamDetailPage } from '../modules/teams/pages/TeamDetailPage';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { RegisterPage } from '../modules/auth/pages/RegisterPage';
import { RequestAccessPage } from '../modules/auth/pages/RequestAccessPage';
import { VerifyOtpPage } from '../modules/auth/pages/VerifyOtpPage';
import { FacultyAcceptInvitationPage } from '../modules/auth/pages/FacultyAcceptInvitationPage';
import { AdminDashboard } from '../modules/admin/pages/AdminDashboard';
import { UniversityFacultyPage } from '../modules/admin/pages/UniversityFacultyPage';
import { FacultyDashboard } from '../modules/faculty/pages/FacultyDashboard';
import { IndustryPartnershipsPage } from '../modules/industry/pages/IndustryPartnershipsPage';
import { PatentsIPPage } from '../modules/research/pages/PatentsIPPage';
import { InstitutionalImpactPage } from '../modules/impact/pages/InstitutionalImpactPage';
import { ProtectedRoute } from '../shared/components/ProtectedRoute';
import { SavedProblemsPage } from '../modules/feed/pages/SavedProblemsPage';
import { NotificationsPage } from '../modules/feed/pages/NotificationsPage';
import { useAuthStore } from '../store/authStore';

export const AppRoutes: React.FC = () => {
  const path = window.location.pathname;
  const { user } = useAuthStore();

  // Auth pages (no 3-column layout)
  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/request-access') return <RequestAccessPage />;
  if (path === '/verify-otp') return <VerifyOtpPage />;
  if (path === '/invite/faculty') return <FacultyAcceptInvitationPage />;

  // Admin Institutional Desk
  if (path === '/admin') {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <MainLayout showRightSidebar={false}>
          <AdminDashboard />
        </MainLayout>
      </ProtectedRoute>
    );
  }

  // University Faculty Management Desk
  if (path === '/university/faculty') {
    return (
      <ProtectedRoute allowedRoles={['university', 'admin']}>
        <MainLayout showRightSidebar={false}>
          <UniversityFacultyPage />
        </MainLayout>
      </ProtectedRoute>
    );
  }

  // Faculty Mentorship Desk
  if (path === '/faculty' || path === '/faculty/dashboard' || path === '/mentoring') {
    return (
      <ProtectedRoute allowedRoles={['faculty', 'admin']}>
        <MainLayout showRightSidebar={false}>
          <FacultyDashboard />
        </MainLayout>
      </ProtectedRoute>
    );
  }

  // Student Innovator Desk & Workspace
  if (path === '/student' || path === '/student/dashboard') {
    return (
      <MainLayout showRightSidebar={false}>
        <StudentDashboard />
      </MainLayout>
    );
  }

  // Industry Partnerships & CSR Collaboration Hub
  if (
    path === '/industry' ||
    path === '/industry/dashboard' ||
    path === '/partnerships' ||
    path === '/industry/partnerships'
  ) {
    return (
      <MainLayout showRightSidebar={false}>
        <IndustryPartnershipsPage />
      </MainLayout>
    );
  }

  // Research, Patents & IP Portfolio Desk
  if (
    path === '/research' ||
    path === '/patents' ||
    path === '/patents-ip' ||
    path === '/ip' ||
    path === '/research/patents'
  ) {
    return (
      <MainLayout showRightSidebar={false}>
        <PatentsIPPage />
      </MainLayout>
    );
  }

  // Institutional & Academic Impact Desk
  if (
    path === '/impact' ||
    path === '/impact/institutional' ||
    path === '/institutional-impact' ||
    path === '/academic-impact'
  ) {
    return (
      <MainLayout showRightSidebar={false}>
        <InstitutionalImpactPage />
      </MainLayout>
    );
  }

  // Universal Role-Aware Dashboard
  if (path === '/dashboard') {
    if (user?.role === 'student') {
      return (
        <MainLayout showRightSidebar={false}>
          <StudentDashboard />
        </MainLayout>
      );
    }
    if (user?.role === 'admin') {
      return (
        <MainLayout showRightSidebar={false}>
          <AdminDashboard />
        </MainLayout>
      );
    }
    if (user?.role === 'faculty') {
      return (
        <ProtectedRoute allowedRoles={['faculty', 'admin']}>
          <MainLayout showRightSidebar={false}>
            <FacultyDashboard />
          </MainLayout>
        </ProtectedRoute>
      );
    }
    if (user?.role === 'university') {
      return (
        <ProtectedRoute allowedRoles={['university', 'admin']}>
          <MainLayout showRightSidebar={false}>
            <InstitutionalImpactPage />
          </MainLayout>
        </ProtectedRoute>
      );
    }
    if (user?.role === 'industry') {
      return (
        <MainLayout showRightSidebar={false}>
          <IndustryPartnershipsPage />
        </MainLayout>
      );
    }
    return (
      <MainLayout>
        <CitizenDashboard />
      </MainLayout>
    );
  }

  if (path === '/citizen/dashboard') {
    return (
      <MainLayout>
        <CitizenDashboard />
      </MainLayout>
    );
  }

  // Solution Pods & Projects Portfolio
  if (path === '/projects' || path === '/my-projects') {
    return (
      <MainLayout showRightSidebar={false}>
        <ProjectsPage />
      </MainLayout>
    );
  }

  if (path === '/my-problems') {
    if (user?.role === 'student') {
      return (
        <MainLayout showRightSidebar={false}>
          <ProjectsPage />
        </MainLayout>
      );
    }
    return (
      <MainLayout>
        <CitizenDashboard />
      </MainLayout>
    );
  }

  // Solution Pod Workspace
  if (path.startsWith('/projects/')) {
    const projectId = path.replace('/projects/', '').split('/')[0];
    return (
      <MainLayout showRightSidebar={false}>
        <ProjectWorkspacePage projectId={projectId} />
      </MainLayout>
    );
  }

  // Discover Fellow Student Innovators
  if (path === '/people') {
    return (
      <MainLayout showRightSidebar={false}>
        <DiscoverPeoplePage />
      </MainLayout>
    );
  }

  if (path === '/saved') return <MainLayout><SavedProblemsPage /></MainLayout>;
  if (path === '/notifications') return <MainLayout><NotificationsPage /></MainLayout>;

  // Account Settings Page
  if (path === '/settings') {
    return (
      <MainLayout showRightSidebar={false}>
        <SettingsPage />
      </MainLayout>
    );
  }

  // Problem Detail Page
  if (path.startsWith('/problems/')) {
    return (
      <MainLayout>
        <ProblemDetailPage />
      </MainLayout>
    );
  }

  // Explore Challenges
  if (path === '/explore' || path === '/nearby') {
    return (
      <MainLayout>
        <ExplorePage />
      </MainLayout>
    );
  }

  // Public user profile — MUST be before '/profile' to avoid prefix collision
  if (path.startsWith('/profile/user/') || path.startsWith('/people/')) {
    const userId = path.replace('/profile/user/', '').replace('/people/', '').split('/')[0] || null;
    return (
      <MainLayout>
        <PublicProfilePage userId={userId} />
      </MainLayout>
    );
  }

  // Profile (own profile)
  if (path === '/profile') {
    return (
      <MainLayout>
        <ProfilePage />
      </MainLayout>
    );
  }

  // Solution Teams
  if (path === '/teams' || path.startsWith('/teams/')) {
    return (
      <MainLayout>
        <TeamDetailPage />
      </MainLayout>
    );
  }

  // Default: Main Social Collaboration Feed
  return (
    <MainLayout>
      <FeedPage />
    </MainLayout>
  );
};
