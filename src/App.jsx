import { lazy, Suspense } from "react";
import { Outlet, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/Spinner";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { HomeRedirect, RequireAccess } from "@/routes/RequireAccess";
import { PATHS } from "@/routes/access";
import LoginPage from "@/screens/auth/LoginPage";
import SignupPage from "@/screens/auth/SignupPage";
import StatusPage from "@/screens/shared/StatusPage";
import AccountPage from "@/screens/shared/AccountPage";
import RedeemPage from "@/screens/redeem/RedeemPage";

// Sign-in, status, account and Redeem are in the main bundle — what an employee opens on a phone
// loads in one go. The owner / manager screens (charts, reports, forms) are fetched when first
// opened, which keeps the first download small.
const OnboardingWizard = lazy(
  () => import("@/screens/onboarding/OnboardingWizard"),
);
const AgreementPage = lazy(() => import("@/screens/account/AgreementPage"));
const ProfilePage = lazy(() => import("@/screens/account/ProfilePage"));
const PlansPage = lazy(() => import("@/screens/plans/PlansPage"));
const DashboardPage = lazy(() => import("@/screens/dashboard/DashboardPage"));
const ReportsPage = lazy(() => import("@/screens/reports/ReportsPage"));
const OffersPage = lazy(() => import("@/screens/offers/OffersPage"));
const RemindersPage = lazy(() => import("@/screens/reminders/RemindersPage"));

// The app shell once the business is approved; a bare page before (the agreement can be read
// and accepted during onboarding).
function ShellWhenApproved() {
  const { session } = useSellerAuth();
  return session?.seller?.status === "active" ? <AppShell /> : <Outlet />;
}

// Every route goes through RequireAccess (routes/access.js decides who may open what).
export default function App() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <Routes>
        <Route element={<RequireAccess />}>
          <Route path={PATHS.login} element={<LoginPage />} />
          <Route path={PATHS.signup} element={<SignupPage />} />
          <Route path={PATHS.status} element={<StatusPage />} />
          <Route path={PATHS.onboarding} element={<OnboardingWizard />} />

          <Route element={<ShellWhenApproved />}>
            <Route path={PATHS.agreement} element={<AgreementPage />} />
          </Route>

          <Route element={<AppShell />}>
            <Route path={PATHS.dashboard} element={<DashboardPage />} />
            <Route path={PATHS.redeem} element={<RedeemPage />} />
            <Route path={`${PATHS.reports}/*`} element={<ReportsPage />} />
            <Route path={PATHS.offers} element={<OffersPage />} />
            <Route path={PATHS.plans} element={<PlansPage />} />
            <Route path={PATHS.reminders} element={<RemindersPage />} />
            <Route path={PATHS.profile} element={<ProfilePage />} />
            <Route path={PATHS.account} element={<AccountPage />} />
          </Route>
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
