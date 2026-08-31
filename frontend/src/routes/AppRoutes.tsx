import React from 'react';
import { MainLayout } from '../shared/components/layout/MainLayout';
import { FeedPage } from '../modules/feed/pages/FeedPage';
import { ProblemDetailPage } from '../modules/feed/pages/ProblemDetailPage';
import { ProfilePage } from '../modules/profile/pages/ProfilePage';
import { ExplorePage } from '../modules/explore/pages/ExplorePage';
import { TeamDetailPage } from '../modules/teams/pages/TeamDetailPage';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { RegisterPage } from '../modules/auth/pages/RegisterPage';
import { RequestAccessPage } from '../modules/auth/pages/RequestAccessPage';
import { VerifyOtpPage } from '../modules/auth/pages/VerifyOtpPage';
import { AdminDashboard } from '../modules/admin/pages/AdminDashboard';
import { UniversityFacultyPage } from '../modules/admin/pages/UniversityFacultyPage';

export const AppRoutes: React.FC = () => {
  const path = window.location.pathname;

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

  // Profile & People
  if (path === '/profile' || path.startsWith('/people/')) {
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
