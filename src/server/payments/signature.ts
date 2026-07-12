import { createHash, timingSafeEqual } from "node:crypto";

type PayjsParams = Record<string, string | number | boolean | null | undefined>;

export function createPayjsSignature(params: PayjsParams, key: string) {
  const query = Object.entries(params)
    .filter(([name, value]) => name !== "sign" && value !== "" && value != null)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([name, value]) => `${name}=${String(value)}`)
    .join("&");
  return createHash("md5").update(`${query}&key=${key}`, "utf8").digest("hex").toUpperCase();
}

export function verifyPayjsSignature(params: PayjsParams & { sign?: string }, key: string) {
  if (!params.sign) return false;
  const expected = Buffer.from(createPayjsSignature(params, key));
  const actual = Buffer.from(params.sign.toUpperCase());
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
