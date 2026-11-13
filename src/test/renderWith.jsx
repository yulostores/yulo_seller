import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { SellerAuthContext } from "@/context/SellerAuthContext";
import { authValue, ROUTER_FUTURE } from "./sessions";

function Landed() {
  return <p data-testid="landed">{useLocation().pathname}</p>;
}

/**
 * Renders one screen at `path` with a fixed auth value, a fresh query cache and a router; any
 * navigation away lands on a marker (data-testid="landed") showing the new path.
 */
export function renderWith(
  ui,
  { session, auth = {}, path = "/", routePath = path } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const value = authValue(session, auth);
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SellerAuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
          <Routes>
            <Route path={routePath} element={ui} />
            <Route path="*" element={<Landed />} />
          </Routes>
        </MemoryRouter>
      </SellerAuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient, auth: value };
}

/** An API error as the client produces it. */
export const apiError = (status, code, message = code, details) =>
  Object.assign(new Error(message), {
    status,
    code,
    details,
    isApiError: true,
  });
