// Starting points for the setup wizard. Examples only fill placeholders,
// so owners see what a good answer looks like without having to delete text.
export interface BusinessType {
  id: string;
  label: string;
  emoji: string;
  noun: string; // "a dental clinic"
  hours: string;
  services: string;
  other: string;
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: "restaurant",
    label: "Restaurant or café",
    emoji: "🍽️",
    noun: "a restaurant",
    hours: "Mon–Fri 11am–10pm, Sat–Sun 9am–11pm",
    services: "Dine-in, takeaway and delivery. Mains from $12. Vegetarian options available.",
    other: "Bookings recommended for groups of 6+. Free parking behind the building.",
  },
  {
    id: "salon",
    label: "Salon or beauty",
    emoji: "💇",
    noun: "a salon",
    hours: "Tue–Sat 9am–7pm, closed Sunday and Monday",
    services: "Haircut $30, colour from $80, manicure $25, pedicure $35.",
    other: "Walk-ins welcome when we're free. Please cancel at least 24 hours ahead.",
  },
  {
    id: "clinic",
    label: "Clinic or dental",
    emoji: "🦷",
    noun: "a clinic",
    hours: "Mon–Sat 8am–6pm, closed Sundays",
    services: "Check-ups, cleaning, fillings, braces. A check-up costs $40.",
    other: "We accept most insurance. For emergencies outside opening hours, please go to the nearest hospital.",
  },
  {
    id: "auto",
    label: "Auto repair",
    emoji: "🔧",
    noun: "an auto repair shop",
    hours: "Mon–Fri 8am–6pm, Sat 9am–1pm",
    services: "Oil change $45, tyre fitting, brakes, diagnostics from $60.",
    other: "Most repairs done same day. We can lend a courtesy car if booked ahead.",
  },
  {
    id: "retail",
    label: "Shop or retail",
    emoji: "🛍️",
    noun: "a shop",
    hours: "Every day 9am–8pm",
    services: "We sell household goods, gifts and stationery. Free gift wrapping.",
    other: "Returns within 30 days with a receipt. We deliver within the city.",
  },
  {
    id: "other",
    label: "Something else",
    emoji: "🏢",
    noun: "a business",
    hours: "Mon–Fri 9am–5pm",
    services: "What you offer and what it costs.",
    other: "Bookings, payment methods, parking, anything customers often ask.",
  },
];

export function suggestGreeting(business: string, assistant: string) {
  const b = business.trim() || "us";
  const a = assistant.trim();
  return `Hello, thanks for contacting ${b}.${a ? ` This is ${a}.` : ""} How can I help you today?`;
}

export function buildKnowledge(f: {
  business: string;
  type: BusinessType;
  location: string;
  hours: string;
  services: string;
  other: string;
}) {
  const lines = [
    `${f.business.trim()} is ${f.type.noun}${f.location.trim() ? ` in ${f.location.trim()}` : ""}.`,
  ];
  if (f.hours.trim()) lines.push(`\nOpening hours: ${f.hours.trim()}`);
  if (f.services.trim()) lines.push(`\nServices and prices:\n${f.services.trim()}`);
  if (f.other.trim()) lines.push(`\nOther things customers should know:\n${f.other.trim()}`);
  return lines.join("\n");
}
