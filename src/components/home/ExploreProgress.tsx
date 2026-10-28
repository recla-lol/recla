"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckIcon } from "@/components/site/Icons";
import { EXPLORE } from "@/components/site/nav";
import { readVisited } from "@/components/site/Track";

/** "Your progress" box under the Explore grid: which of the six places this browser has opened. */
export function ExploreProgress() {
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- local storage is read after mount
    setSeen(readVisited());
  }, []);
  const done = EXPLORE.filter((e) => seen.includes(e.href)).length;
  const next = EXPLORE.find((e) => !seen.includes(e.href));
  return (
    <div className="rc-card mt-8 p-6" data-testid="explore-progress">
      <div className="flex items-center justify-between gap-3">
        <span className="rc-label">Places opened</span>
        <span className="rc-mono text-lime">
          {done} / {EXPLORE.length} opened
        </span>
      </div>
      <div className="rc-progress mt-6">
        <span style={{ width: `${(done / EXPLORE.length) * 100}%` }} />
      </div>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
        {EXPLORE.map((e) => {
          const on = seen.includes(e.href);
          return (
            <Link key={e.href} href={e.href} className={`rc-check ${on ? "on" : ""}`}>
              <span className="box">{on ? <CheckIcon size={10} /> : null}</span>
              {e.title}
            </Link>
          );
        })}
      </div>
      <p className="rc-small mt-6 text-ink">
        {next ? (
          <>
            Next:{" "}
            <Link href={next.href} className="rc-link">
              {next.title}
            </Link>{" "}
            — {next.text}
          </>
        ) : (
          "You have opened all six. Thank you for checking instead of trusting."
        )}
      </p>
    </div>
  );
}
