let sharpInstance: typeof import("sharp") | null = null;

export function getSharp() {
  if (!sharpInstance) {
    sharpInstance = require("sharp");
  }
  return sharpInstance;
}
