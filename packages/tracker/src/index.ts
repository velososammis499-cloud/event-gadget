import { Tracker } from './core/tracker';
import { initPageViewCollector } from './collectors/page-view';
import { initClickCollector } from './collectors/click';
import { initImpressionCollector } from './collectors/impression';
import { initFormInteractionCollector } from './collectors/form-interaction';
import { initDwellCollector } from './collectors/dwell';
import type { TrackerConfig } from './types';

export type {
  TrackerConfig,
  TrackEvent,
  TrackBatch,
  EventType,
  PayloadOf,
  SourceInfo,
  PageInfo,
  DeviceInfo,
  NavigationChain,
  ChainEntry,
  CollectorInit,
  TrackerCore,
} from './types';

export { schemas, TrackEventSchema, TrackBatchSchema, getSchema, MAX_CHAIN_LENGTH } from './types';

let singleton: Tracker | null = null;

export function initTracker(config: TrackerConfig): Tracker {
  if (singleton) {
    if (config.debug) {
      console.warn('[Event Gadget] already initialized, returning existing instance');
    }
    return singleton;
  }

  const tracker = new Tracker(config);
  tracker.init([initPageViewCollector, initClickCollector, initImpressionCollector, initFormInteractionCollector, initDwellCollector]);

  singleton = tracker;
  return tracker;
}

export { Tracker, initPageViewCollector, initClickCollector, initImpressionCollector, initFormInteractionCollector, initDwellCollector };
