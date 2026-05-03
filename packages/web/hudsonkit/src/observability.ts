import { HObservability } from './observability/core';

export { HLogger, HMetrics, HObservability, HSpan, HTrace } from './observability/core';
export type {
  HLogEvent,
  HLogInput,
  HLogLevel,
  HMetricEvent,
  HMetricInput,
  HMetricType,
  HObservabilityOptions,
  HObservation,
  HObservationBase,
  HObservationData,
  HObservationKind,
  HObservationSink,
  HObservationTags,
  HSubscribeOptions,
  HTraceInput,
  HTraceSpan,
  HTraceStatus,
  HUnsubscribe,
} from './types/observability';

export const HObservabilityDefault = HObservability.global();
