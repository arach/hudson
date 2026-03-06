// ---------------------------------------------------------------------------
// Port & Pipe types — inter-app data piping
// ---------------------------------------------------------------------------

/** Declares a data output that an app can expose. */
export interface AppOutput {
  id: string;
  name: string;
  /** Semantic data type, e.g. 'svg', 'json', 'text' */
  dataType: string;
  description?: string;
}

/** Declares a data input that an app can accept. */
export interface AppInput {
  id: string;
  name: string;
  /** Semantic data type this input accepts */
  dataType: string;
  description?: string;
}

/** Static port declarations on a HudsonApp. */
export interface AppPorts {
  outputs?: AppOutput[];
  inputs?: AppInput[];
}

/** A persisted pipe definition (stored as JSON in .data/pipes/). */
export interface PipeDefinition {
  id: string;
  name: string;
  source: { appId: string; portId: string };
  sink: { appId: string; portId: string };
  createdAt: number;
  lastPushedAt: number | null;
  enabled: boolean;
}
