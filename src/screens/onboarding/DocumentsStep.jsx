import { useRef, useState } from "react";
import { CheckCircle2, Eye, FileUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/FormError";
import { onboardingApi } from "@/api/seller.api";
import { errorMessage } from "@/lib/errors";
import {
  DOCUMENT_MIME,
  DOCUMENT_TYPES,
  fileError,
  requiredDocuments,
} from "./validate";

const OPTIONAL = ["shop_photo", "business_registration", "other"];

/** ID documents: upload, view (streamed through the API), remove. */
export function DocumentsStep({ form, onChanged, onNext }) {
  const required = requiredDocuments(form);
  const docs = form.documents ?? [];
  const [busyType, setBusyType] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const missing = required.filter((t) => !docs.some((d) => d.type === t));

  async function upload(type, file) {
    const problem = fileError(file);
    if (problem) return setErrors((x) => ({ ...x, [type]: problem }));
    setErrors((x) => ({ ...x, [type]: "" }));
    setBusyType(type);
    setError("");
    try {
      const { documents } = await onboardingApi.uploadDocument(type, file);
      onChanged({
        ...form,
        documents,
        missing: (form.missing ?? []).filter((m) => m !== `document:${type}`),
      });
    } catch (err) {
      setErrors((x) => ({
        ...x,
        [type]: errorMessage(err, "Upload failed. Please try again."),
      }));
    } finally {
      setBusyType(null);
    }
  }

  async function remove(doc) {
    setError("");
    try {
      const { documents } = await onboardingApi.deleteDocument(doc._id);
      const stillThere = documents.some((d) => d.type === doc.type);
      onChanged({
        ...form,
        documents,
        missing:
          !stillThere && required.includes(doc.type)
            ? [...(form.missing ?? []), `document:${doc.type}`]
            : form.missing,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not remove the document."));
    }
  }

  async function view(doc) {
    setError("");
    try {
      const blob = await onboardingApi.documentFile(doc._id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(errorMessage(err, "Could not open the document."));
    }
  }

  const row = (type, isRequired) => {
    const mine = docs.filter((d) => d.type === type);
    return (
      <li
        key={type}
        className="rounded-xl border bg-white p-4"
        data-testid={`doc-${type}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{DOCUMENT_TYPES[type]}</span>
          {isRequired ? (
            <Badge variant={mine.length ? "ok" : "warn"}>
              {mine.length ? "Uploaded" : "Required"}
            </Badge>
          ) : (
            <Badge variant="muted">Optional</Badge>
          )}
          <span className="flex-1" />
          <UploadButton
            type={type}
            busy={busyType === type}
            onFile={(file) => upload(type, file)}
          />
        </div>
        {mine.map((d) => (
          <div key={d._id} className="mt-3 flex items-center gap-2 text-sm">
            <CheckCircle2
              className="h-4 w-4 text-brand-green"
              aria-hidden="true"
            />
            <span className="flex-1 truncate">
              {d.name ?? DOCUMENT_TYPES[type]}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => view(d)}
              aria-label={`View ${DOCUMENT_TYPES[type]}`}
            >
              <Eye aria-hidden="true" />
            </Button>
            {d.status !== "verified" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(d)}
                aria-label={`Remove ${DOCUMENT_TYPES[type]}`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        ))}
        {errors[type] ? (
          <p className="mt-2 text-xs text-red-600">{errors[type]}</p>
        ) : null}
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Clear photos or PDFs, up to 5 MB each. Yulo checks each number against
        its document.
      </p>
      <ul className="space-y-3">{required.map((t) => row(t, true))}</ul>
      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">
          More documents (optional)
        </summary>
        <ul className="mt-3 space-y-3">{OPTIONAL.map((t) => row(t, false))}</ul>
      </details>
      <FormError message={error} />
      <div className="flex items-center justify-end gap-3">
        {missing.length ? (
          <p className="text-xs text-muted-foreground">
            Still needed: {missing.map((t) => DOCUMENT_TYPES[t]).join(", ")}
          </p>
        ) : null}
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function UploadButton({ type, busy, onFile }) {
  const input = useRef(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={DOCUMENT_MIME.join(",")}
        className="hidden"
        aria-label={`Upload ${DOCUMENT_TYPES[type]}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <FileUp aria-hidden="true" /> {busy ? "Uploading…" : "Upload"}
      </Button>
    </>
  );
}
