declare module 'say' {
  export function speak(
    text: string,
    voice?: string | null,
    speed?: number | null,
    callback?: (err: Error | null) => void,
  ): void;
  export function stop(): void;
  export function getInstalledVoices(
    callback: (err: Error | null, voices: string[]) => void,
  ): void;
}
