const WARN_THRESHOLD = 10 * 1024 * 1024;  // 10 MB (per screen, assets are larger than events)
const STOP_THRESHOLD = 15 * 1024 * 1024;  // 15 MB

export type SizeGuardCallback = (action: 'warn' | 'stop', sizeBytes: number) => void;

export class SizeGuard {
  private estimatedSize = 0;
  private warned = false;
  private stopped = false;
  private callback: SizeGuardCallback;

  constructor(callback: SizeGuardCallback) {
    this.callback = callback;
  }

  addBytes(bytes: number): boolean {
    if (this.stopped) return false;

    this.estimatedSize += bytes;

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
