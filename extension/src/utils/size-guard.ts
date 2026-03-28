const WARN_THRESHOLD = 2.5 * 1024 * 1024; // 2.5 MB
const STOP_THRESHOLD = 5 * 1024 * 1024;   // 5 MB

export type SizeGuardCallback = (action: 'warn' | 'stop', sizeBytes: number) => void;

export class SizeGuard {
  private estimatedSize = 0;
  private warned = false;
  private stopped = false;
  private callback: SizeGuardCallback;

  constructor(callback: SizeGuardCallback) {
    this.callback = callback;
  }

  /**
   * Feed a new event to the size guard.
   * Returns true if recording should continue, false if it should stop.
   */
  addEvent(event: unknown): boolean {
    if (this.stopped) return false;

    // Approximate size of JSON-serialized event
    try {
      const json = JSON.stringify(event);
      this.estimatedSize += json.length;
    } catch {
      // If serialization fails, estimate 500 bytes
      this.estimatedSize += 500;
    }

    if (this.estimatedSize >= STOP_THRESHOLD) {
      this.stopped = true;
      this.callback('stop', this.estimatedSize);
      return false;
    }

    if (!this.warned && this.estimatedSize >= WARN_THRESHOLD) {
      this.warned = true;
      this.callback('warn', this.estimatedSize);
    }

    return true;
  }

  getEstimatedSize(): number {
    return this.estimatedSize;
  }

  reset(): void {
    this.estimatedSize = 0;
    this.warned = false;
    this.stopped = false;
  }
}
