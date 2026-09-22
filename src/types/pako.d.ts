declare module 'pako' {
  export interface DeflateOptions {
    level?: number;
    windowBits?: number;
    memLevel?: number;
    strategy?: number;
    raw?: boolean;
    to?: 'string';
  }

  export function deflate(
    data: Uint8Array | ArrayBuffer | string,
    options?: DeflateOptions,
  ): Uint8Array;

  export function inflate(
    data: Uint8Array | ArrayBuffer | string,
    options?: { raw?: boolean },
  ): Uint8Array;
}
