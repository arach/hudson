import { createStatusPalette } from "studio";
import type { ProposalStatus } from "./proposals";

/**
 * Hudson's ProposalStatus → tone + display label mapping.
 * Tone names come from studio's StatusTone — `ok`/`warn`/`error`/`info`/`neutral` —
 * which are the keys for `--status-{tone}-fg` / `--status-{tone}-bg` CSS vars
 * declared in studio/theme.css.
 */
export const proposalPalette = createStatusPalette<ProposalStatus>({
  live: { tone: "ok", label: "Live" },
  active: { tone: "info", label: "Active" },
  draft: { tone: "warn", label: "Draft" },
  done: { tone: "neutral", label: "Done" },
  other: { tone: "neutral", label: "Status" },
});
