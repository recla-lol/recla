import Link from "next/link";
import { ASSETS } from "@/config/assets";
import { BRAND } from "@/config/brand";

/** Lockup: square mark + spaced word mark. */
export function Brand() {
  return (
    <Link href="/" className="rc-brand" aria-label={`${BRAND.name} home`}>
      <img src={ASSETS.mark} alt="" width={36} height={36} />
      <span>{BRAND.name}</span>
    </Link>
  );
}
