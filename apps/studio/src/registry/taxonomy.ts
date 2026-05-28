export type Bucket = "foundations" | "atoms" | "compositions" | "proposals";

export type Surface = "web" | "native";

export type Status = "live" | "draft" | "placeholder";

const BUCKET_LABELS: Record<Bucket, string> = {
  foundations: "Foundations",
  atoms: "Atoms",
  compositions: "Compositions",
  proposals: "Proposals",
};

const SURFACE_LABELS: Record<Surface, string> = {
  web: "Web",
  native: "Native",
};

export function bucketLabel(bucket: Bucket): string {
  return BUCKET_LABELS[bucket];
}

export function surfaceLabel(surface: Surface): string {
  return SURFACE_LABELS[surface];
}

export const BUCKET_ORDER: readonly Bucket[] = [
  "foundations",
  "atoms",
  "compositions",
  "proposals",
];

export const SURFACE_ORDER: readonly Surface[] = ["web", "native"];
