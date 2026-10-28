import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BRAND } from "@/config/brand";
import { GAS } from "@/config/gas";
import { DeployPanel } from "@/components/deploy/DeployPanel";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import ART from "@/lib/contracts/artifacts.json";

export const metadata: Metadata = {
  title: "Deploy contracts",
  description: `Owner tool: deploy the ${BRAND.name} contract from your own wallet.`,
  robots: { index: false, follow: false },
};

// Owner tool, local only: on any public host this route is a 404.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const dynamic = "force-dynamic";

export default async function DeployPage() {
  const host = (await headers()).get("host") ?? "";
  if (!LOCAL_HOST.test(host)) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main" className="rc-main">
        <div className="rc-wrap py-16">
          <p className="rc-eyebrow">Owner tool · localhost only</p>
          <h1 className="rc-h2 mt-4">Deploy ReclaSourceRegistry</h1>
          <p className="mt-4 max-w-[62ch] text-soft">
            One transaction, signed in your wallet on Robinhood Chain. No constructor arguments, no owner, no fee and no token needed, so it can go live before the token launches. Progress is kept in this browser. Deployment uses about {GAS.deploy.toLocaleString("en-US")} gas (measured on a local fork of Robinhood Chain).
          </p>
          <div className="mt-10">
            <DeployPanel registry={{ creation: ART.contracts.ReclaSourceRegistry.creation, sha256: ART.contracts.ReclaSourceRegistry.sha256 }} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
