import { type ReactNode } from "react";
import {
  DataRow,
  EngDocSheet,
  EngMarkdown,
  PageStrip,
  useStudioRouter,
} from "studio";
import {
  findEngBySlug,
  proposalKindLabel,
  buildEngExtraPages,
  type Proposal,
  type ProposalSibling,
  type RelatedToken,
} from "../content";
import { proposalPalette } from "../content/status-palette";
import { registry, type Status } from "../registry";
import { NotFoundPage } from "./NotFoundPage";

const { StatusPill } = proposalPalette;
const ENG_EXTRA_PAGES = buildEngExtraPages();
// Studio's DataRow uses `px-4 sm:px-6` internally — we bump direct-child
// rows to `px-8` so the label column sits on the same axis as the article
// body text (`<main>` already pads `px-8`). EngDocSheet wraps children in
// one inner div, so direct rows live at `>div>*`.
const SHEET_FRAME =
  "-mx-8 border-y border-studio-edge bg-studio-canvas " +
  "[&>div>*]:!px-8 " +
  "[&>div>*+*]:border-t [&>div>*+*]:border-studio-rule";

const renderSidebarStatusPill = (status: Status): ReactNode => {
  if (status === "live") return null;
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
      {status}
    </span>
  );
};

export function DocPage({ slug }: { slug: string }) {
  const resolved = findEngBySlug(slug);
  if (!resolved) return <NotFoundPage path={`/eng/${slug}`} />;

  const { proposal, siblings, related } = resolved;
  const summarySection = proposal.headerSections.find(
    (s) => s.label === "Summary",
  );

  return (
    <>
      <PageStrip
        registry={registry}
        extraPages={ENG_EXTRA_PAGES}
        renderStatusPill={renderSidebarStatusPill}
      />
      <main className="max-w-[820px] px-8 pt-5 pb-20">
        <ProposalHeaderSheet
          proposal={proposal}
          summary={summarySection?.body}
          siblings={siblings}
        />

        <div className="mt-8">
          <EngMarkdown body={proposal.body} fromSlug={proposal.slug} />
        </div>

        {related.length > 0 ? <RelatedSection tokens={related} /> : null}

        <Colophon proposal={proposal} />
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Header sheet — essential at-a-glance rows only: id/kind/shell, status,
// title, summary (lifted), siblings. Reference material (owner, targets,
// source, related) lives in the colophon below the body.
// ---------------------------------------------------------------------------

interface ProposalHeaderSheetProps {
  proposal: Proposal;
  summary?: string;
  siblings: ProposalSibling[];
}

function ProposalHeaderSheet({
  proposal,
  summary,
  siblings,
}: ProposalHeaderSheetProps) {
  return (
    <EngDocSheet className={SHEET_FRAME}>
      <DataRow label="Proposal" labelWidth={88}>
        <MetaList>
          <MetaToken kind="id">{proposal.id}</MetaToken>
          <MetaToken>{proposalKindLabel(proposal.kind)}</MetaToken>
          <MetaToken>
            {proposal.origin === "apple" ? "iOS / macOS shell" : "Web shell"}
          </MetaToken>
        </MetaList>
      </DataRow>

      {proposal.meta.status || proposal.meta.statusRaw ? (
        <DataRow label="Status" labelWidth={88}>
          <div className="flex flex-wrap items-baseline gap-2.5">
            {proposal.meta.status ? (
              <StatusPill status={proposal.meta.status} variant="outlined" />
            ) : null}
            {proposal.meta.statusRaw ? (
              <span className="font-mono text-[10.5px] text-studio-ink-faint">
                {proposal.meta.statusRaw}
              </span>
            ) : null}
          </div>
        </DataRow>
      ) : null}

      <DataRow label="Title" labelWidth={88}>
        <h1 className="m-0 text-[24px] font-medium leading-[1.15] tracking-tight text-studio-ink-strong">
          {proposal.title}
        </h1>
      </DataRow>

      {summary ? (
        <DataRow label="Summary" labelWidth={88}>
          <EngMarkdown body={summary} fromSlug={proposal.slug} compact />
        </DataRow>
      ) : null}

      {siblings.length > 0 ? (
        <DataRow label="Siblings" labelWidth={88}>
          <SiblingsList siblings={siblings} />
        </DataRow>
      ) : null}
    </EngDocSheet>
  );
}

// ---------------------------------------------------------------------------
// Colophon — meta strip below the body. Owner / Targets / extra fields /
// Source as DataRows inside an EngDocSheet (per studio's own guidance —
// EngDocSheet's doc string flags this as the canonical use case).
// ---------------------------------------------------------------------------

function Colophon({ proposal }: { proposal: Proposal }) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (proposal.meta.owner) {
    rows.push({
      label: "Owner",
      value: (
        <span className="font-mono text-[11px] text-studio-ink">
          {proposal.meta.owner}
        </span>
      ),
    });
  }
  if (proposal.meta.targets) {
    rows.push({
      label: "Targets",
      value: (
        <span className="text-[12px] leading-relaxed text-studio-ink">
          {proposal.meta.targets}
        </span>
      ),
    });
  }
  for (const x of proposal.meta.extra) {
    rows.push({
      label: x.label,
      value: <span className="text-[12px] text-studio-ink">{x.value}</span>,
    });
  }
  rows.push({
    label: "Source",
    value: (
      <code className="font-mono text-[10.5px] text-studio-ink-faint">
        {proposal.source}
      </code>
    ),
  });

  return (
    <EngDocSheet className={`mt-14 ${SHEET_FRAME}`}>
      {rows.map((row) => (
        <DataRow key={row.label} label={row.label} labelWidth={88}>
          {row.value}
        </DataRow>
      ))}
    </EngDocSheet>
  );
}

// ---------------------------------------------------------------------------
// Related section — appears after body, before colophon. Editorial list of
// linked HUD refs + doc paths + plain text fragments.
// ---------------------------------------------------------------------------

function RelatedSection({ tokens }: { tokens: RelatedToken[] }) {
  return (
    <section className="mt-12 border-t border-studio-rule pt-6">
      <div className="mb-3 flex items-baseline gap-3">
        <div className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-studio-ink-faint">
          · Related
        </div>
        <div className="ml-2 h-px flex-1 bg-studio-rule" />
      </div>
      <RelatedList tokens={tokens} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hudson-specific bits — MetaList/MetaToken/SiblingsList/RelatedList. Not
// in studio (yet). DataRow + EngDocSheet + PageStrip + StatusPill come from
// studio.
// ---------------------------------------------------------------------------

function MetaList({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      {children}
    </div>
  );
}

function MetaToken({
  kind = "secondary",
  children,
}: {
  kind?: "id" | "secondary";
  children: ReactNode;
}) {
  if (kind === "id") {
    return (
      <span className="font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-studio-ink-strong">
        {children}
      </span>
    );
  }
  return (
    <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-studio-ink-faint">
      · {children}
    </span>
  );
}

function SiblingsList({ siblings }: { siblings: ProposalSibling[] }) {
  const { Link } = useStudioRouter();
  return (
    <ul className="m-0 flex flex-col gap-1.5">
      {siblings.map((s) => (
        <li key={s.slug} className="flex items-baseline gap-3">
          <span className="min-w-[72px] font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-studio-ink-faint">
            {proposalKindLabel(s.kind)}
          </span>
          <Link
            href={s.href}
            className="text-[13px] text-studio-ink underline decoration-studio-rule underline-offset-[3px] hover:decoration-studio-ink"
          >
            {s.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RelatedList({ tokens }: { tokens: RelatedToken[] }) {
  const { Link } = useStudioRouter();
  const rendered: ReactNode[] = [];
  tokens.forEach((token, i) => {
    if (i > 0)
      rendered.push(
        <span key={`sep-${i}`} className="text-studio-ink-faint">
          ,{" "}
        </span>,
      );
    if (token.kind === "proposal-ref" && token.href) {
      rendered.push(
        <Link
          key={`t-${i}`}
          href={token.href}
          className="text-studio-ink underline decoration-studio-rule underline-offset-[3px] hover:decoration-studio-ink"
        >
          {token.text}
        </Link>,
      );
    } else if (token.kind === "proposal-ref") {
      rendered.push(
        <span
          key={`t-${i}`}
          className="font-mono text-[11.5px] text-studio-ink"
        >
          {token.text}
        </span>,
      );
    } else if (token.kind === "doc-path") {
      rendered.push(
        <code
          key={`t-${i}`}
          className="rounded bg-studio-chip-bg px-1 py-0.5 font-mono text-[10.5px] text-studio-ink"
        >
          {token.text.replace(/^`|`$/g, "")}
        </code>,
      );
    } else {
      rendered.push(
        <span key={`t-${i}`} className="text-[12px] text-studio-ink">
          {token.text}
        </span>,
      );
    }
  });
  return <div className="text-[12px] leading-relaxed">{rendered}</div>;
}
