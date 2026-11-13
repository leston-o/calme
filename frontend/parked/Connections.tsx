import {
  CalendarCheck,
  CalendarDays,
  Hash,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  PhoneForwarded,
  PhoneOutgoing,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Agent } from "../lib/api";
import { Badge, cx } from "./ui";

interface Integration {
  name: string;
  does: string; // what it does for the owner, in plain words
  icon: LucideIcon;
  tint: string;
}

// Shown as "coming soon" until the backend supports connecting each one.
const GROUPS: { title: string; blurb: string; items: Integration[] }[] = [
  {
    title: "Phone calls",
    blurb: "Keep the number your customers already know.",
    items: [
      {
        name: "Your main business number",
        does: "Forward calls from your existing number when you're busy or closed.",
        icon: PhoneForwarded,
        tint: "bg-brand-50 text-brand-700",
      },
      {
        name: "Transfer to a person",
        does: "Put urgent callers straight through to you or a staff member.",
        icon: PhoneOutgoing,
        tint: "bg-emerald-50 text-emerald-700",
      },
    ],
  },
  {
    title: "Bookings",
    blurb: "Let your assistant book appointments while it's on the call.",
    items: [
      { name: "Calendly", does: "Book callers into your Calendly availability.", icon: CalendarCheck, tint: "bg-sky-50 text-sky-700" },
      { name: "Google Calendar", does: "Check free times and add bookings to your calendar.", icon: CalendarDays, tint: "bg-blue-50 text-blue-700" },
      { name: "Outlook Calendar", does: "Check free times and add bookings in Microsoft 365.", icon: CalendarDays, tint: "bg-cyan-50 text-cyan-700" },
    ],
  },
  {
    title: "Messages",
    blurb: "Hear about every call without listening to them.",
    items: [
      { name: "Email", does: "Get a short summary and any messages after each call.", icon: Mail, tint: "bg-amber-50 text-amber-700" },
      { name: "Text messages (SMS)", does: "Text callers a booking confirmation or your address.", icon: MessageSquareText, tint: "bg-violet-50 text-violet-700" },
      { name: "WhatsApp Business", does: "Follow up with callers on WhatsApp.", icon: MessageCircle, tint: "bg-green-50 text-green-700" },
    ],
  },
  {
    title: "Other tools",
    blurb: "Keep your other systems up to date automatically.",
    items: [
      { name: "Google Business Profile", does: "Use your Google listing's hours and details.", icon: MapPin, tint: "bg-red-50 text-red-700" },
      { name: "Slack", does: "Post new messages and bookings to a channel.", icon: Hash, tint: "bg-fuchsia-50 text-fuchsia-700" },
      { name: "HubSpot", does: "Save callers and notes to your customer list.", icon: Users, tint: "bg-orange-50 text-orange-700" },
      { name: "Zapier", does: "Connect to thousands of other apps.", icon: Workflow, tint: "bg-orange-50 text-orange-700" },
    ],
  },
];

export default function Connections({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-sm text-slate-600">
        <span className="font-medium text-slate-900">Coming soon.</span> Connect the tools you
        already use so {agent.name} can book appointments, pass on messages and keep you posted.
      </div>
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">{g.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{g.blurb}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((i) => (
              <div
                key={i.name}
                aria-disabled="true"
                className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 opacity-60 grayscale"
              >
                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", i.tint)}>
                  <i.icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{i.name}</span>
                    <Badge>Coming soon</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{i.does}</p>
                </div>
                <button
                  disabled
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200"
                >
                  Connect
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
