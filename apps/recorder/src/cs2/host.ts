/** Where the recorder's Windows programs (HLAE, CS2, HLAE's ffmpeg) run, and how to reach them. */
export interface GameHost {
  /** Starts a Windows program from its local path, in its own folder. */
  spawn(program: string, args: string[], env?: Record<string, string>): void
  /**
   * Pids of the recorder's Windows processes whose command line contains `needle` but not
   * `exclude`.
   */
  processes(needle: string, exclude?: string): Promise<number[]>
  kill(pids: number[]): Promise<void>
  /** Stops every Windows process the recorder started. */
  stopAll(): Promise<void>
  /** A local path as the Windows programs see it. */
  windowsPath(path: string): string
}
