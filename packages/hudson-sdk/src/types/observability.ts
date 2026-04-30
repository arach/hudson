export type HLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type HMetricType = 'counter' | 'gauge' | 'timing';

export type HTraceStatus = 'active' | 'ok' | 'error';

export type HObservationKind = 'log' | 'metric' | 'span';

export type HObservationData = Record<string, unknown>;

export type HObservationTags = Record<string, string | number | boolean>;

export interface HObservationBase {
  id: string;
  kind: HObservationKind;
  timestamp: number;
  category?: string;
  data?: HObservationData;
}

export interface HLogEvent extends HObservationBase {
  kind: 'log';
  level: HLogLevel;
  message: string;
}

export interface HMetricEvent extends HObservationBase {
  kind: 'metric';
  metricType: HMetricType;
  name: string;
  value: number;
  unit?: string;
  tags?: HObservationTags;
}

export interface HTraceSpan extends HObservationBase {
  kind: 'span';
  name: string;
  traceId: string;
  parentId?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: HTraceStatus;
  error?: {
    name?: string;
    message: string;
  };
}

export type HObservation = HLogEvent | HMetricEvent | HTraceSpan;

export type HObservationSink = (event: HObservation) => void;

export type HUnsubscribe = () => void;

export interface HSubscribeOptions {
  replay?: boolean;
  kinds?: HObservationKind[];
}

export interface HObservabilityOptions {
  enabled?: boolean;
  maxBufferSize?: number;
  now?: () => number;
  createId?: () => string;
}

export interface HLogInput {
  category?: string;
  data?: HObservationData;
}

export interface HMetricInput {
  category?: string;
  unit?: string;
  tags?: HObservationTags;
  data?: HObservationData;
}

export interface HTraceInput {
  category?: string;
  parentId?: string;
  traceId?: string;
  data?: HObservationData;
}
