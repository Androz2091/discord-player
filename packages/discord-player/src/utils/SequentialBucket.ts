import { setTimeout } from 'timers/promises';
import { AsyncQueue } from './AsyncQueue';

export type RequestEntity = () => Promise<Response>;

export class SequentialBucket {
  public limit = 1;
  public remaining = 1;
  public resetAfter = 0;
  public queue = new AsyncQueue();
  public MAX_RETRIES = 5;

  /**
   * Checks if the bucket is rate limited.
   */
  public isRateLimited() {
    return this.remaining <= 0 && Date.now() < this.resetAfter;
  }

  /**
   * Enqueues a request.
   * @param req The request function to enqueue
   */
  public async enqueue(req: RequestEntity) {
    const entry = this.queue.acquire();
    await entry.getTask();

    try {
      return this._request(req);
    } finally {
      entry.release();
    }
  }

  private async _request(req: RequestEntity, retries = 0): Promise<Response> {
    while (this.isRateLimited()) {
      const reset = this.resetAfter - Date.now();
      await setTimeout(reset);
    }

    let pass = false;

    try {
      const res = await req();

      this._patchHeaders(res);

      if (res.status === 429) {
        const reset = this.resetAfter - Date.now();
        await setTimeout(reset);
        return this._request(req);
      }

      if (!res.ok) {
        let err: Error;

        try {
          const body: {
            code: number;
            name: string;
            message: string;
          } = await res.json();

          const error = new Error(body.message) as Error & { code: number };

          error.name = body.name;
          error.code = body.code;

          err = error;
        } catch {
          err = new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        }

        pass = true;

        throw err;
      }

      return res;
    } catch (e) {
      if (pass) throw e;

      const badReq = e instanceof Error && /Error: 4[0-9]{2}/.test(e.message);

      if (!badReq && retries < this.MAX_RETRIES) {
        return this._request(req, ++retries);
      }

      throw e;
    }
  }

  private _patchHeaders(res: Response) {
    const limit = Number(res.headers.get('X-RateLimit-Limit'));
    const remaining = Number(res.headers.get('X-RateLimit-Remaining'));
    const resetAfter =
      Number(res.headers.get('X-RateLimit-Reset')) * 1000 + Date.now();

    if (!Number.isNaN(limit)) this.limit = limit;
    if (!Number.isNaN(remaining)) this.remaining = remaining;
    if (!Number.isNaN(resetAfter)) this.resetAfter = resetAfter;
  }
}
