declare module '@lydell/node-pty' {
  export interface IDisposable {
    dispose(): void;
  }

  export type IEvent<T> = (listener: (event: T) => void) => IDisposable;

  export interface IPty {
    readonly pid: number;
    readonly cols: number;
    readonly rows: number;
    readonly process: string;
    onData: IEvent<string>;
    onExit: IEvent<{ exitCode: number; signal?: number }>;
    write(data: string | Buffer): void;
    resize(columns: number, rows: number, pixelSize?: { width: number; height: number }): void;
    clear(): void;
    kill(signal?: string): void;
    pause(): void;
    resume(): void;
  }

  export interface IPtyForkOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string | undefined>;
  }

  export function spawn(file: string, args: string[] | string, options?: IPtyForkOptions): IPty;
}
