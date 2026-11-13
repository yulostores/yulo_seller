export function FormError({ message }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-brand-maroon/20 bg-[#FCE9E4] px-3 py-2 text-sm text-brand-maroon"
    >
      {message}
    </p>
  );
}

export function FieldError({ id, message }) {
  return message ? (
    <p id={id} className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  ) : null;
}
