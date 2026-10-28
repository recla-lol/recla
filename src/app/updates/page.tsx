import { BRAND } from "@/config/brand";
import { Doc } from "@/components/site/Doc";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/updates", title: `Update history | ${BRAND.name}`, description: `Each change to what ${BRAND.name} states on this site, with its date and the reason: sources added, corrections, launch timing.` });

export default function UpdatesPage() {
  return (
    <Doc
      path="/updates"
      crumb="Update history"
      eyebrow="Update history"
      title="Each statement change, with its date."
      lead="Newest first. When a statement here changes — a source added, a date moved, a mistake corrected — it gets a dated line with the reason."
      sections={[
        {
          h: "30 October 2026",
          list: [
            "Site published: claim check, Merkle eligibility, vesting tracker, refund explorer, simulator, claim history, source verification, safety quiz.",
            "Built-in sources: Pons creator fee escrow (0xd3AF…Ac9e) and HoodLock locks (0xD0f7…C32F), read paths confirmed against their verified code.",
            "ReclaSourceRegistry written and tested; not deployed yet, so the registry page runs in practice mode.",
            `${BRAND.symbol}: not launched. No contract address is published; any address you see elsewhere is not ours.`,
          ],
        },
      ]}
    />
  );
}
