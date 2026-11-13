// The frame around the sign-in and sign-up screens: a brand panel on wide screens, the form on
// the right (or alone on a phone).
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen font-sans">
      <aside className="hidden w-[44%] flex-col justify-between bg-sidebar-gradient p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-brand-gradient" />
          <span className="text-lg font-bold tracking-tight text-white">
            Yulo Partner
          </span>
        </div>
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-saffron">
            Coupon partner portal
          </p>
          <h2 className="text-[32px] font-bold leading-snug text-white">
            Bring Yulo&apos;s diners
            <br />
            <span className="text-brand-saffron">to your door.</span>
          </h2>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/50">
            Your coupons reach customers right after they order food on Yulo.
            Redeem them at the counter and see who came back.
          </p>
        </div>
        <p className="text-xs text-white/30">
          © {new Date().getFullYear()} Yulo Stores
        </p>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center bg-brand-page px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="h-7 w-7 rounded-lg bg-brand-gradient" />
            <span className="font-bold">Yulo Partner</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-dark">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          <div className="mt-8">{children}</div>
          {footer ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
