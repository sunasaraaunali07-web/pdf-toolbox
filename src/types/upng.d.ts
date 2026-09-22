declare module '@pdf-lib/upng' {
  interface UPNGInterface {
    encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number): ArrayBuffer;
    decode(buffer: ArrayBuffer): { width: number; height: number; data: Uint8Array };
    toRGBA8(out: { width: number; height: number; data: Uint8Array }): ArrayBuffer[];
  }

  const UPNG: UPNGInterface & { default?: UPNGInterface };
  export default UPNG;
}
