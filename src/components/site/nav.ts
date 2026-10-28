/** Site navigation (top bar, drawer, footer). One list each, so every place stays in step. */

export const TOP_NAV = [
  { href: "/check", label: "Claim check" },
  { href: "/about", label: "About" },
  { href: "/limits", label: "Limits" },
  { href: "/sources", label: "Sources" },
  { href: "/history", label: "History" },
  { href: "/registry", label: "Registry" },
  { href: "/simulate", label: "Simulator" },
  { href: "/faq", label: "FAQ" },
] as const;

export const FOOTER_COLS = [
  {
    title: "Project",
    links: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About Recla" },
      { href: "/limits", label: "What Recla is not" },
    ],
  },
  {
    title: "The record",
    links: [
      { href: "/sources", label: "Supported sources" },
      { href: "/history", label: "Claim history" },
      { href: "/updates", label: "Update history" },
    ],
  },
  {
    title: "Take part",
    links: [
      { href: "/check", label: "Claim check" },
      { href: "/simulate", label: "Claim simulator" },
      { href: "/refunds", label: "Refund explorer" },
      { href: "/registry", label: "Source registry" },
      { href: "/quiz", label: "Safety quiz" },
    ],
  },
  {
    title: "Information",
    links: [
      { href: "/token", label: "Token information" },
      { href: "/verify", label: "How to verify" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
] as const;

export const LEGAL = [
  { href: "/risks", label: "Risks" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

/** The six places of the home "Explore" grid; visiting one ticks it in the progress tracker. */
export const EXPLORE = [
  { href: "/check", title: "Claim check", text: "Paste a wallet. See what supported contracts say it can claim." },
  { href: "/sources", title: "Sources", text: "Every source with its contract, rules link and explorer page." },
  { href: "/simulate", title: "Simulator", text: "Run the exact claim from your address. Nothing is sent." },
  { href: "/quiz", title: "Safety quiz", text: "Seven fake-claim traps, each answered on the spot." },
  { href: "/refunds", title: "Refund explorer", text: "Only refunds a contract states itself, never guesses." },
  { href: "/registry", title: "Source registry", text: "Register a source, attest its rules or flag it, on chain." },
] as const;
