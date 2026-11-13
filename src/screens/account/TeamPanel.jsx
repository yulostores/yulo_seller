import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/FormError";
import { GENDER_OPTIONS, SelectField, TextField } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { teamApi } from "@/api/seller.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";
import { ROLE_LABELS } from "@/routes/access";
import { memberBody, validateMember } from "@/screens/onboarding/validate";

const KEY = ["team"];
const ROLE_HELP = {
  owner: "Owner — everything",
  manager: "Manager — reports, offers, employees",
  employee: "Employee — redeems coupons",
};
const blank = (role) => ({
  name: "",
  phone: "",
  role,
  dateOfBirth: "",
  gender: "",
  experienceYears: "",
});

/**
 * The team. Owners manage anyone but themselves; managers see and manage employees only. The
 * server enforces the same rules (canManage / manageableRoles come from it).
 */
export function TeamPanel() {
  const { session } = useSellerAuth();
  const isManager = session?.user?.role === "manager";
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: teamApi.list });

  if (query.isLoading) return <Spinner />;
  if (query.isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          <p role="alert" className="text-red-700">
            {errorMessage(query.error, "Could not load your team.")}
          </p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }
  const { members, manageableRoles } = query.data;
  const visible = isManager
    ? members.filter((m) => m.role === "employee")
    : members;
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{isManager ? "Employees" : "Team"}</CardTitle>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No {isManager ? "employees" : "team members"} yet.
            </p>
          ) : (
            <ul className="divide-y">
              {visible.map((m) => (
                <MemberRow
                  key={m._id}
                  member={m}
                  manageableRoles={manageableRoles}
                  onChanged={refresh}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {manageableRoles.length ? (
        <AddMember manageableRoles={manageableRoles} onAdded={refresh} />
      ) : null}
    </div>
  );
}

function MemberRow({ member, manageableRoles, onChanged }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function changeRole(role) {
    setBusy(true);
    setError("");
    try {
      await teamApi.update(member._id, { role });
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not change the role."));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setError("");
    try {
      await teamApi.remove(member._id);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not remove this person."));
      setBusy(false);
    }
  }

  return (
    <li className="py-3" data-testid={`member-${member.phone}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {member.name}{" "}
            {member.isYou ? (
              <span className="text-xs text-muted-foreground">(you)</span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">+91 {member.phone}</p>
        </div>
        {member.canManage ? (
          <select
            aria-label={`Role of ${member.name}`}
            className="h-9 rounded-lg border bg-white px-2 text-sm"
            value={member.role}
            disabled={busy}
            onChange={(e) => changeRole(e.target.value)}
          >
            {[...new Set([member.role, ...manageableRoles])].map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <Badge
            variant={
              member.role === "owner"
                ? "danger"
                : member.role === "manager"
                  ? "info"
                  : "muted"
            }
          >
            {ROLE_LABELS[member.role]}
          </Badge>
        )}
        {member.canManage && !confirming ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Deactivate
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <div
          role="alertdialog"
          aria-label={`Deactivate ${member.name}`}
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-maroon/20 bg-[#FCE9E4] p-3 text-sm"
        >
          <span className="flex-1">
            {member.name} will be signed out and can no longer sign in.
          </span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={deactivate}
          >
            Yes, deactivate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      <FormError message={error} />
    </li>
  );
}

function AddMember({ manageableRoles, onAdded }) {
  const defaultRole = manageableRoles.includes("employee")
    ? "employee"
    : manageableRoles[0];
  const [f, setF] = useState(() => blank(defaultRole));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: "" }));
    setNotice("");
  };

  async function submit(e) {
    e.preventDefault();
    const found = validateMember(f);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError("");
    try {
      const member = await teamApi.add(memberBody(f));
      setF(blank(defaultRole));
      setNotice(`${member.name} can now sign in with +91 ${member.phone}.`);
      onAdded();
    } catch (err) {
      if (err?.code === "DUPLICATE_PHONE")
        setErrors({ phone: "Someone on your team already uses this number" });
      else setError(errorMessage(err, "Could not add this person."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Add a person
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="add-name"
              label="Name"
              value={f.name}
              onChange={set("name")}
              error={errors.name}
            />
            <TextField
              id="add-phone"
              label="Mobile"
              inputMode="tel"
              value={f.phone}
              onChange={set("phone")}
              error={errors.phone}
            />
            <SelectField
              id="add-role"
              label="Role"
              value={f.role}
              onChange={set("role")}
              error={errors.role}
              options={manageableRoles.map((r) => ({
                value: r,
                label: ROLE_HELP[r],
              }))}
            />
            <TextField
              id="add-dob"
              label="Date of birth (optional)"
              type="date"
              value={f.dateOfBirth}
              onChange={set("dateOfBirth")}
              error={errors.dateOfBirth}
            />
            <SelectField
              id="add-gender"
              label="Gender (optional)"
              value={f.gender}
              onChange={set("gender")}
              options={GENDER_OPTIONS}
              placeholder="—"
            />
            <TextField
              id="add-exp"
              label="Experience, years (optional)"
              type="number"
              min={0}
              max={80}
              value={f.experienceYears}
              onChange={set("experienceYears")}
              error={errors.experienceYears}
            />
          </div>
          <FormError message={error} />
          {notice ? (
            <p role="status" className="text-sm text-brand-green">
              {notice}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
