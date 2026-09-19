import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const BUTTON_BASE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export const buttonClass = (variant: "primary" | "secondary" = "primary") =>
  `${BUTTON_BASE} ${
    variant === "primary"
      ? "bg-brand text-ink hover:brightness-110"
      : "border border-line bg-surface text-white hover:border-brand/60"
  }`;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return <button className={`${buttonClass(variant)} ${className}`} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface/80 p-6 backdrop-blur ${className}`}>{children}</section>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "w-full rounded-xl border border-line bg-ink px-4 text-sm text-white outline-none transition placeholder:text-muted/60 focus:border-brand";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} h-11 ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} min-h-24 py-3 ${props.className ?? ""}`} />;
}

export function Notice({ tone, children }: { tone: "danger" | "success" | "muted"; children: ReactNode }) {
  const color = { danger: "text-danger", success: "text-success", muted: "text-muted" }[tone];
  return <p className={`text-sm ${color}`}>{children}</p>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/80 p-5">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="heading mt-2 text-2xl">{value}</p>
    </div>
  );
}
