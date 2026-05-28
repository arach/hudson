import type { StudioPage } from "studio";
import type { Bucket, Surface, Status } from "../registry";
import {
  getProposal,
  proposalsToStudioPages,
  proposalKindLabel,
  parseRelated,
  getProposalSiblings,
  type Proposal,
  type ProposalSibling,
  type RelatedToken,
} from "./proposals";

export type EngPages = StudioPage<Bucket, Surface, Status>[];

export interface EngResolved {
  proposal: Proposal;
  siblings: ProposalSibling[];
  related: RelatedToken[];
}

/**
 * Resolve `/eng/<slug>` against the proposal catalog. Returns the full
 * proposal plus pre-computed siblings + parsed Related tokens so the
 * page can render the header sheet without re-running parsers.
 */
export function findEngBySlug(slug: string): EngResolved | null {
  const proposal = getProposal(slug.toLowerCase());
  if (!proposal) return null;
  return {
    proposal,
    siblings: getProposalSiblings(proposal.slug),
    related: parseRelated(proposal.meta.related),
  };
}

export function buildEngExtraPages(): EngPages {
  return proposalsToStudioPages();
}

export { proposalKindLabel };
export type { Proposal, ProposalSibling, RelatedToken };
