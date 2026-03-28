import type { eventWithTime } from 'rrweb';

export interface InteractiveElement {
  selector: string;
  tag: string;
  type: 'button' | 'link' | 'input' | 'select' | 'toggle' | 'other';
  text: string;
  rect: { x: number; y: number; width: number; height: number } | null;
  source: 'static-scan' | 'click';
}

export interface DemoframeRecording {
  version: '0.1.0';
  url: string;
  title: string;
  viewport: { width: number; height: number };
  recordedAt: string;
  duration: number;
  events: eventWithTime[];
  interactiveElements: InteractiveElement[];
  metadata: {
    eventCount: number;
    elementCount: number;
    sizeBytes: number;
  };
}

export function buildRecording(
  events: eventWithTime[],
  interactiveElements: InteractiveElement[],
  url: string,
  title: string,
): DemoframeRecording {
  const firstTimestamp = events.length > 0 ? events[0].timestamp : Date.now();
  const lastTimestamp = events.length > 0 ? events[events.length - 1].timestamp : Date.now();

  const recording: DemoframeRecording = {
    version: '0.1.0',
    url,
    title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    recordedAt: new Date(firstTimestamp).toISOString(),
    duration: lastTimestamp - firstTimestamp,
    events,
    interactiveElements,
    metadata: {
      eventCount: events.length,
      elementCount: interactiveElements.length,
      sizeBytes: 0,
    },
  };

  // Calculate approximate size
  const json = JSON.stringify(recording);
  recording.metadata.sizeBytes = new Blob([json]).size;

  return recording;
}
