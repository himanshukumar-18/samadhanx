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
import { AdminDashboard } from '../modules/admin/pages/AdminDashboard';
import { UniversityFacultyPage } from '../modules/admin/pages/UniversityFacultyPage';
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

  // Admin Institutional Desk
  if (path === '/admin') {
    return (
      <MainLayout showRightSidebar={false}>
        <AdminDashboard />
      </MainLayout>
    );
  }

  // University Faculty Management Desk
  if (path === '/university/faculty') {
    return (
      <MainLayout showRightSidebar={false}>
        <UniversityFacultyPage />
      </MainLayout>
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
