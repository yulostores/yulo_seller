import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/FormError";
import { Spinner } from "@/components/Spinner";
import { accountApi } from "@/api/seller.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { PATHS } from "@/routes/access";

const KEY = ["agreement"];

/** The partner agreement: its text and version, who accepted it and when; the owner accepts. */
export default function AgreementPage() {
  const { session } = useSellerAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: accountApi.agreement });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = session?.user?.role === "owner";
  const approved = session?.seller?.status === "active";

  async function accept() {
    setBusy(true);
    setError("");
    try {
      queryClient.setQueryData(
        KEY,
        await accountApi.acceptAgreement(query.data.version),
      );
    } catch (err) {
      if (err?.code === "AGREEMENT_CHANGED") {
        setError(
          "The agreement was just updated. Please read the new version.",
        );
        setAgreed(false);
        await query.refetch();
      } else setError(errorMessage(err, "Could not record your acceptance."));
    } finally {
      setBusy(false);
    }
  }

  const page = (body) => (
    <div
      className={
        approved ? "mx-auto max-w-3xl" : "min-h-screen bg-brand-page px-4 py-8"
      }
    >
      <div className={approved ? "" : "mx-auto max-w-3xl"}>
        {!approved ? (
          <Link
            to={PATHS.status}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Application
            status
          </Link>
        ) : null}
        <h1 className="mb-4 text-2xl font-bold text-brand-dark">
          Partner agreement
        </h1>
        {body}
      </div>
    </div>
  );

  if (query.isLoading) return page(<Spinner />);
  if (query.isError) {
    return page(
      <Card>
        <CardContent className="p-6 text-sm">
          <p role="alert" className="text-red-700">
            {errorMessage(query.error, "Could not load the agreement.")}
          </p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>,
    );
  }
  const a = query.data;
  if (!a.published) {
    return page(
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Yulo hasn&apos;t published the partner agreement yet. You&apos;ll find
          it here once it&apos;s ready.
        </CardContent>
      </Card>,
    );
  }

  return page(
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Version {a.version}</CardTitle>
        {a.upToDate ? (
          <Badge variant="ok">Accepted</Badge>
        ) : (
          <Badge variant="warn">
            {a.acceptance
              ? "New version — not accepted yet"
              : "Not accepted yet"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-secondary/40 p-4 text-sm leading-relaxed"
          data-testid="agreement-text"
        >
          {a.text}
        </div>
        {a.acceptance ? (
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2
              className="h-4 w-4 text-brand-green"
              aria-hidden="true"
            />
            Version {a.acceptance.version} accepted on{" "}
            {formatDate(a.acceptance.acceptedAt)}
            {a.acceptance.acceptedByName
              ? ` by ${a.acceptance.acceptedByName}`
              : ""}
            .
          </p>
        ) : null}
        {!a.upToDate && isOwner ? (
          <div className="space-y-3 rounded-xl border p-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              I have read version {a.version} of the partner agreement and
              accept it on behalf of {session?.seller?.businessName}.
            </label>
            <FormError message={error} />
            <Button onClick={accept} disabled={!agreed || busy}>
              {busy ? "Saving…" : "Accept agreement"}
            </Button>
          </div>
        ) : null}
        {!a.upToDate && !isOwner ? (
          <p className="text-sm text-muted-foreground">
            The owner of the business accepts the agreement.
          </p>
        ) : null}
      </CardContent>
    </Card>,
  );
}
