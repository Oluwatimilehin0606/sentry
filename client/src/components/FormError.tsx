/** A form-level error (e.g. "That email and password don't match"), shown above the fields. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-critical/30 bg-critical-soft px-3 py-2.5 text-sm text-critical">
      {message}
    </div>
  );
}
