import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { ROLE_LABELS } from "@/routes/access";

// The signed-in person's own account (every role).
export default function AccountPage() {
  const { session, logout } = useSellerAuth();
  const rows = [
    ["Name", session?.user?.name],
    ["Mobile", session?.user?.phone ? `+91 ${session.user.phone}` : "—"],
    ["Role", ROLE_LABELS[session?.user?.role] ?? session?.user?.role],
    ["Business", session?.seller?.businessName],
  ];
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>My account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <Button variant="outline" className="mt-5 w-full" onClick={logout}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
