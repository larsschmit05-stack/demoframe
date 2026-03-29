// ── Snapshot Format (replaces rrweb recording format) ─────────────

export interface InteractiveElement {
  selector: string;
  tag: string;
  type: 'button' | 'link' | 'input' | 'select' | 'toggle' | 'tab' | 'other';
  text: string;
  rect: { x: number; y: number; width: number; height: number } | null;
}

export interface ScreenSnapshot {
  name: string;
  sourceUrl: string;
  html: string;
  viewport: { width: number; height: number };
  interactiveElements: InteractiveElement[];
  capturedAt: string;
  sizeBytes: number;
}

export interface DemoCapture {
  version: '0.2.0';
  screens: ScreenSnapshot[];
  appUrl: string;
  metadata: {
    screenCount: number;
    totalSizeBytes: number;
  };
}

export function buildDemoCapture(screens: ScreenSnapshot[]): DemoCapture {
  const totalSize = screens.reduce((sum, s) => sum + s.sizeBytes, 0);

  return {
    version: '0.2.0',
    screens,
    appUrl: screens.length > 0 ? new URL(screens[0].sourceUrl).origin : '',
    metadata: {
      screenCount: screens.length,
      totalSizeBytes: totalSize,
    },
  };
}
