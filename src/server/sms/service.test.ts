import { describe, expect, it } from "vitest";
import { SmsService, type SmsChallengeRecord, type SmsChallengeStore, type SmsProvider } from "./service";

class MemoryStore implements SmsChallengeStore {
  records: SmsChallengeRecord[] = [];
  async latest(phoneNumber: string) { return this.records.filter((x) => x.phoneNumber === phoneNumber).at(-1) ?? null; }
  async countPhoneSince(phoneNumber: string, since: Date) { return this.records.filter((x) => x.phoneNumber === phoneNumber && x.createdAt >= since).length; }
  async countIpSince(ipAddress: string, since: Date) { return this.records.filter((x) => x.ipAddress === ipAddress && x.createdAt >= since).length; }
  async create(record: Omit<SmsChallengeRecord, "id" | "consumedAt">) { const value = { ...record, id: String(this.records.length + 1), consumedAt: null }; this.records.push(value); return value; }
  async consume(id: string, consumedAt: Date) { const item = this.records.find((x) => x.id === id && !x.consumedAt); if (!item) return false; item.consumedAt = consumedAt; return true; }
}

class MemoryProvider implements SmsProvider {
  sent: Array<{ phoneNumber: string; code: string }> = [];
  async sendCode(phoneNumber: string, code: string) { this.sent.push({ phoneNumber, code }); }
}

describe("短信验证码服务", () => {
  const now = new Date("2026-07-11T10:00:00Z");

  it("发送验证码并在五分钟内只允许消费一次", async () => {
    const store = new MemoryStore();
    const provider = new MemoryProvider();
    const service = new SmsService({ store, provider, secret: "test-secret", now: () => now });
    await service.send("13800138000", "127.0.0.1", "888888");
    expect(provider.sent).toEqual([{ phoneNumber: "13800138000", code: "888888" }]);
    await expect(service.verify("13800138000", "888888")).resolves.toBe(true);
    await expect(service.verify("13800138000", "888888")).resolves.toBe(false);
  });

  it("同一手机号六十秒内不能重复发送", async () => {
    const store = new MemoryStore();
    const service = new SmsService({ store, provider: new MemoryProvider(), secret: "test-secret", now: () => now });
    await service.send("13800138000", "127.0.0.1", "888888");
    await expect(service.send("13800138000", "127.0.0.1", "888888")).rejects.toThrow("请稍后再试");
  });

  it("验证码过期或不正确时拒绝核验", async () => {
    let clock = now;
    const store = new MemoryStore();
    const service = new SmsService({ store, provider: new MemoryProvider(), secret: "test-secret", now: () => clock });
    await service.send("13800138000", "127.0.0.1", "888888");
    expect(await service.verify("13800138000", "000000")).toBe(false);
    clock = new Date(now.getTime() + 301_000);
    expect(await service.verify("13800138000", "888888")).toBe(false);
  });
});
