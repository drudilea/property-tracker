/** A minimal async mutex: serializes `run()` calls one at a time, FIFO. */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task, task);
      // keep the chain alive regardless of success/failure, without unhandled rejections
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}
