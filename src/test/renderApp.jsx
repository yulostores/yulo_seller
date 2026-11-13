import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { SellerAuthProvider } from "@/context/SellerAuthContext";
import { HomeRedirect, RequireAccess } from "@/routes/RequireAccess";
import { PATHS } from "@/routes/access";
import LoginPage from "@/screens/auth/LoginPage";
import SignupPage from "@/screens/auth/SignupPage";
import { ROUTER_FUTURE } from "./sessions";

function Landed() {
  return <p data-testid="landed">{useLocation().pathname}</p>;
}

/**
 * The real provider and guard with the real login / signup screens; every other screen is a
 * marker that shows where the user landed. The auth API is mocked by the calling test.
 */
export function renderApp(path = PATHS.login) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
        <SellerAuthProvider>
          <Routes>
            <Route element={<RequireAccess />}>
              <Route path={PATHS.login} element={<LoginPage />} />
              <Route path={PATHS.signup} element={<SignupPage />} />
              {Object.values(PATHS)
                .filter((p) => p !== PATHS.login && p !== PATHS.signup)
                .map((p) => (
                  <Route key={p} path={p} element={<Landed />} />
                ))}
            </Route>
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </SellerAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

/** A sign-in response. */
export function sessionResponse({
  role = "owner",
  status = "active",
  business = "Glow Salon",
} = {}) {
  return {
    accessToken: `token-${role}`,
    user: {
      _id: `u-${role}`,
      name: "Asha Rao",
      phone: "9822222221",
      role,
      sellerId: "s1",
    },
    seller: {
      _id: "s1",
      businessName: business,
      status,
      rejectionReason: null,
    },
    permissions: ["redeem"],
  };
}
