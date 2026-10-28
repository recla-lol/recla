"use client";

import { useState } from "react";

type Q = { scenario: string; options: string[]; answer: number; why: string };

/** Seven fake-claim patterns. Answers are checked in the browser; nothing is stored or sent. */
export const QUESTIONS: Q[] = [
  {
    scenario: "A message says your wallet is eligible for a drop and links to a claim page. The page asks you to approve unlimited spending of your USDG \"to verify eligibility\".",
    options: ["Approve; it is only a check", "Close the page; a claim never needs an approval of your tokens", "Approve a small amount instead"],
    answer: 1,
    why: "A claim moves tokens to you. An approval lets someone else move tokens away from you. No eligibility check needs one.",
  },
  {
    scenario: "A site shows a large claimable balance and asks for a 0.05 ETH \"unlock fee\" sent to an address before the claim works.",
    options: ["Pay it; the balance is bigger", "Ask in their chat for a discount", "Leave; real claim contracts pay out for network gas only"],
    answer: 2,
    why: "Fees paid to an address before a claim are the classic advance-fee pattern. A contract that owes you pays when you call it.",
  },
  {
    scenario: "Someone in your DMs says they work for a recovery service and can get back what was drained from your wallet if you share your seed phrase.",
    options: ["Share it; they need it to help", "Never share it; no tool can reverse a confirmed transaction", "Share only half of it"],
    answer: 1,
    why: "Confirmed transactions cannot be reversed by anyone, and a seed phrase gives full control. Recovery offers in DMs are a second theft.",
  },
  {
    scenario: "The claim button opens your wallet with a \"Sign message\" request full of unreadable hex, called a permit.",
    options: ["Sign; messages are free", "Reject; a permit signature can authorise spending without a transaction", "Sign and revoke later"],
    answer: 1,
    why: "Permit-style signatures cost no gas but can hand over a token allowance. Read what you sign; a normal claim is a plain contract call.",
  },
  {
    scenario: "A token named after a project you like shows up in your wallet with a link in its name to \"claim the rest\".",
    options: ["Visit the link", "Ignore it; unsolicited tokens with links are bait", "Sell it right away through the link"],
    answer: 1,
    why: "Anyone can send any token to any address. Names and links inside tokens are written by whoever deployed them.",
  },
  {
    scenario: "Two claim pages look identical. One contract address differs from the project's official one by a few characters in the middle.",
    options: ["Use either; the start and end match", "Compare every character and use only the one the project published", "Use the one with more holders"],
    answer: 1,
    why: "Look-alike addresses are generated to match the first and last characters. Check the whole address, then open it on the explorer.",
  },
  {
    scenario: "Before claiming, you run the claim through a simulator and it says the call would revert.",
    options: ["Send it anyway with more gas", "Stop and read the reason; the real transaction would fail the same way", "Try a different wallet"],
    answer: 1,
    why: "A dry run executes the same code on the same state. If it reverts, sending it would revert too and you would only lose gas.",
  },
];

export function Quiz() {
  const [picked, setPicked] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const score = picked.filter((p, i) => p === QUESTIONS[i].answer).length;
  const answered = picked.filter((p) => p !== null).length;
  return (
    <div>
      <ol className="m-0 grid list-none gap-6 p-0" data-testid="quiz">
        {QUESTIONS.map((q, i) => {
          const p = picked[i];
          return (
            <li key={i} className="rc-card p-6">
              <p className="rc-mono m-0 text-lime" style={{ fontSize: 11 }}>
                {String(i + 1).padStart(2, "0")} / {QUESTIONS.length}
              </p>
              <p className="mt-3 text-[16px] leading-[26px] text-ink">{q.scenario}</p>
              <div className="mt-4 grid gap-2">
                {q.options.map((o, k) => {
                  const state = p === null ? "" : k === q.answer ? "border-lime text-lime" : k === p ? "border-coral text-coral" : "opacity-60";
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={p !== null}
                      onClick={() => setPicked((arr) => arr.map((v, j) => (j === i ? k : v)))}
                      className={`border border-line bg-transparent px-4 py-3 text-left text-[15px] text-soft ${state}`}
                      data-testid={`quiz-${i}-${k}`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              {p !== null ? (
                <p className={`mt-4 text-[14px] ${p === q.answer ? "rc-ok" : "text-coral"}`}>
                  {p === q.answer ? "Right. " : "Not this one. "}
                  <span className="text-soft">{q.why}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="rc-card mt-8 flex flex-wrap items-center justify-between gap-4 p-6" data-testid="quiz-score">
        <span className="rc-label">
          Score {score} of {QUESTIONS.length} · {answered} answered
        </span>
        <button type="button" className="rc-btn ghost" onClick={() => setPicked(QUESTIONS.map(() => null))}>
          Start again
        </button>
      </div>
    </div>
  );
}
