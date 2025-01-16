declare module 'node:child_process' {
  interface ChildProcessWithoutNullStreams {
    _handlers?: {
      onData: (chunk: Buffer) => void;
      onStderr: (chunk: Buffer) => void;
      onError: (error: Error) => void;
      onExit: (code: number) => void;
      onEnd: () => void;
    };
  }
}

export interface FFmpegProcessHandlers {
  onData: (chunk: Buffer) => void;
  onStderr: (chunk: Buffer) => void;
  onError: (error: Error) => void;
  onExit: (code: number) => void;
  onEnd: () => void;
}
