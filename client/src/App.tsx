import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { PublicLayout } from '@/components/PublicLayout';
import { RequireAuth } from '@/components/RequireAuth';
import { LandingPage } from '@/pages/LandingPage';

// The landing page ships in the main bundle; everything else loads only when visited.
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const WebsitesPage = lazy(() => import('@/pages/WebsitesPage').then((m) => ({ default: m.WebsitesPage })));
const WebsitePage = lazy(() => import('@/pages/WebsitePage').then((m) => ({ default: m.WebsitePage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ReportPage = lazy(() => import('@/pages/ReportPage').then((m) => ({ default: m.ReportPage })));
const AccountPage = lazy(() => import('@/pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const SignInPage = lazy(() => import('@/pages/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('@/pages/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
        <Routes>
          {/* Anyone can see these. */}
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
          </Route>
          {/* Sign-in, sign-up and password reset bring their own split-screen frame. */}
          <Route path="sign-in" element={<SignInPage />} />
          <Route path="sign-up" element={<SignUpPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />

          {/* Using Sentry needs an account. */}
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="home" element={<HomePage />} />
              <Route path="websites" element={<WebsitesPage />} />
              <Route path="websites/:hostname" element={<WebsitePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportPage />} />
              <Route path="account" element={<AccountPage />} />
            </Route>
          </Route>

          <Route element={<PublicLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
