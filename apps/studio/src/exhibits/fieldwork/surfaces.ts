/**
 * Fieldwork design surfaces — single registry for exhibits, embeds, and Flows.
 */

import type { ComponentType } from "react";
import { CandidateOrientation } from "./CandidateOrientation";
import { CandidateActiveWork } from "./CandidateActiveWork";
import { CandidatePause } from "./CandidatePause";
import { CandidateHandoff } from "./CandidateHandoff";
import { CandidateDone } from "./CandidateDone";
import { CandidateShare } from "./CandidateShare";
import { ProducerRoleWorld } from "./ProducerRoleWorld";
import { ProducerMint } from "./ProducerMint";
import { ProducerCompile } from "./ProducerCompile";
import { ReviewIndex } from "./ReviewIndex";
import { ReviewDocument } from "./ReviewDocument";
import { ReviewSource } from "./ReviewSource";
import { ReviewCalibrate } from "./ReviewCalibrate";
import { InterviewerAttention } from "./InterviewerAttention";
import { InterviewerMark } from "./InterviewerMark";
import { InterviewerReveal } from "./InterviewerReveal";

export type FieldworkSurface = {
  slug: string;
  label: string;
  Component: ComponentType;
  pageId?: string;
};

export const FIELDWORK_SURFACES: readonly FieldworkSurface[] = [
  // Candidate
  {
    slug: "candidate-orientation",
    label: "Candidate · Orientation",
    Component: CandidateOrientation,
    pageId: "page_8b9f828f572d",
  },
  {
    slug: "candidate-active-work",
    label: "Candidate · Active work",
    Component: CandidateActiveWork,
    pageId: "page_2f09e630dbce",
  },
  {
    slug: "candidate-share",
    label: "Candidate · Share",
    Component: CandidateShare,
    pageId: "page_860589c7f37b",
  },
  {
    slug: "candidate-pause",
    label: "Candidate · Pause",
    Component: CandidatePause,
    pageId: "page_0a76b270118f",
  },
  {
    slug: "candidate-handoff",
    label: "Candidate · Handoff",
    Component: CandidateHandoff,
    pageId: "page_f9330f46e4d5",
  },
  {
    slug: "candidate-done",
    label: "Candidate · Done",
    Component: CandidateDone,
    pageId: "page_0dc0a514fd32",
  },
  // Producer
  {
    slug: "producer-role-world",
    label: "Producer · Role world",
    Component: ProducerRoleWorld,
    pageId: "page_850650d40280",
  },
  {
    slug: "producer-mint",
    label: "Producer · Mint session",
    Component: ProducerMint,
    pageId: "page_698fcb596e98",
  },
  {
    slug: "producer-compile",
    label: "Producer · Compile",
    Component: ProducerCompile,
    pageId: "page_7f3754a44547",
  },
  // Interviewer
  {
    slug: "interviewer-attention",
    label: "Interviewer · Attention",
    Component: InterviewerAttention,
    pageId: "page_63ab5c9a35ba",
  },
  {
    slug: "interviewer-mark",
    label: "Interviewer · Mark",
    Component: InterviewerMark,
    pageId: "page_a0e5abd1ceff",
  },
  {
    slug: "interviewer-reveal",
    label: "Interviewer · Reveal",
    Component: InterviewerReveal,
    pageId: "page_3e4e99c63a26",
  },
  // Review
  {
    slug: "review-index",
    label: "Review · Index",
    Component: ReviewIndex,
    pageId: "page_d6854a04953f",
  },
  {
    slug: "review-document",
    label: "Review · Document",
    Component: ReviewDocument,
    pageId: "page_12ad43a4f942",
  },
  {
    slug: "review-source",
    label: "Review · Source",
    Component: ReviewSource,
    pageId: "page_8fe081d4f064",
  },
  {
    slug: "review-calibrate",
    label: "Review · Calibrate",
    Component: ReviewCalibrate,
    pageId: "page_590da978e5c6",
  },
];

export function surfacesBySlug(): Record<string, ComponentType> {
  return Object.fromEntries(
    FIELDWORK_SURFACES.map((s) => [s.slug, s.Component]),
  );
}
