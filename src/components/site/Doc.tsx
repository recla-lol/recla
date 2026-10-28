import { Page, PageHead } from "@/components/site/Page";

export type DocSection = { h: string; p?: string[]; list?: string[] };

/** A plain reading page: head, then sections of paragraphs and lists. */
export function Doc({ eyebrow, title, lead, path, crumb, sections, children }: { eyebrow: string; title: string; lead?: string; path: string; crumb: string; sections: DocSection[]; children?: React.ReactNode }) {
  return (
    <Page crumb={{ name: crumb, path }}>
      <PageHead eyebrow={eyebrow} title={title} lead={lead} />
      <section className="rc-sec pad">
        <div className="rc-wrap">
          <div className="rc-doc">
            {sections.map((s) => (
              <div key={s.h}>
                <h2>{s.h}</h2>
                {s.p?.map((t, i) => (
                  <p key={i}>{t}</p>
                ))}
                {s.list ? (
                  <ul>
                    {s.list.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
            {children}
          </div>
        </div>
      </section>
    </Page>
  );
}
