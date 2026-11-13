import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-slate-950 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-950",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
  danger: "bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50",
};

export function Button({
  variant = "primary",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Drop the body padding, e.g. for edge-to-edge tables. */
  flush?: boolean;
}) {
  return (
    <section
      className={cx("rounded-[1.25rem] border border-slate-200/80 bg-white", className)}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-slate-950">{title}</h2>
            )}
            {description && <p className="mt-0.5 text-[0.8125rem] text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-6"}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 " +
  "focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-950/5 disabled:bg-slate-50";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputBase, "resize-y", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputBase, props.className)} />;
}

type Tone = "slate" | "green" | "amber" | "red" | "blue";

const tones: Record<Tone, string> = {
  slate: "bg-slate-50 text-slate-600",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  blue: "bg-brand-50 text-brand-700 ring-brand-600/20",
};

const dots: Record<Tone, string> = {
  slate: "bg-slate-400",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-brand-500",
};

export function Badge({
  tone = "slate",
  dot,
  children,
}: {
  tone?: Tone;
  /** Lead with a status dot (status pills always pair the dot with a label). */
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-slate-200/70",
        tones[tone],
      )}
    >
      {dot && <span className={cx("size-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

export function Alert({
  tone = "error",
  children,
  onClose,
}: {
  tone?: "error" | "success";
  children: ReactNode;
  onClose?: () => void;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      className={cx(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" />
      {label ?? "Loading…"}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className={cx("font-display text-5xl leading-[1.02] tracking-tight text-slate-950", eyebrow != null && "mt-3")}>
          {title}
        </h1>
        {description && <p className="mt-3 max-w-xl text-[0.9375rem] text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-slate-950 p-3 text-white">{icon}</div>
      <h3 className="font-display text-3xl leading-tight text-slate-950">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between px-6 pt-6">
          <h2 className="font-display text-3xl leading-tight">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="text-sm text-slate-600">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          className={danger ? "!bg-red-600 !text-white hover:!bg-red-700 !border-red-600" : ""}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  // Stable tint per name so an agent keeps its color everywhere.
  const palette = [
    "bg-brand-50 text-brand-700 ring-brand-200",
    "bg-violet-50 text-violet-700 ring-violet-200",
    "bg-emerald-50 text-emerald-700 ring-emerald-200",
    "bg-amber-50 text-amber-700 ring-amber-200",
    "bg-rose-50 text-rose-700 ring-rose-200",
    "bg-cyan-50 text-cyan-700 ring-cyan-200",
  ];
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display ring-1 ring-inset",
        size === "sm" && "size-7 text-sm",
        size === "md" && "size-10 text-lg",
        size === "lg" && "size-14 text-2xl",
        palette[hash % palette.length],
      )}
    >
      {initials || "?"}
    </span>
  );
}

/** Small uppercase label above a heading, as on the landing page. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500",
        className,
      )}
    >
      <span className="h-px w-6 bg-slate-300" />
      {children}
    </div>
  );
}

export { cx };
