/**
 * Runs one task at a time. While a task is active, repeated requests are
 * collapsed into the most recent pending request instead of competing with it.
 */
export class SingleFlightLatestQueue<T> {
  private running = false;
  private stopped = false;
  private pending: T | null = null;
  private activeController: AbortController | null = null;
  private drainPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly task: (request: T, signal: AbortSignal) => Promise<void>,
  ) {}

  enqueue(request: T): Promise<void> {
    if (this.stopped) return Promise.resolve();

    if (this.running) {
      this.pending = request;
      return this.drainPromise;
    }

    this.drainPromise = this.drain(request);
    return this.drainPromise;
  }

  stop(): void {
    this.stopped = true;
    this.pending = null;
    this.activeController?.abort();
  }

  resume(): void {
    this.stopped = false;
  }

  private async drain(initialRequest: T): Promise<void> {
    this.running = true;
    let request: T | null = initialRequest;

    try {
      while (request !== null && !this.stopped) {
        this.activeController = new AbortController();
        await this.task(request, this.activeController.signal);
        this.activeController = null;
        request = this.pending;
        this.pending = null;
      }
    } finally {
      this.activeController = null;
      this.running = false;
    }
  }
}
