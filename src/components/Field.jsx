import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/FormError";

const SELECT_CLASS =
  "mt-2 flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

/** A labelled input with its error under it. Extra props go to the <input>. */
export function TextField({
  id,
  label,
  error,
  hint,
  className = "",
  ...props
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-2"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {hint && !error ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** A labelled native <select>. `options` = [{ value, label }]. */
export function SelectField({
  id,
  label,
  error,
  options,
  placeholder,
  className = "",
  ...props
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={SELECT_CLASS}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {placeholder !== undefined ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];
