import { createHmac, timingSafeEqual } from "node:crypto";
import { phoneSchema } from "@/lib/validation/auth";

export type SmsChallengeRecord = {
  id: string;
  phoneNumber: string;
  codeHash: string;
  ipAddress: string;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
};

export interface SmsChallengeStore {
  latest(phoneNumber: string): Promise<SmsChallengeRecord | null>;
  countPhoneSince(phoneNumber: string, since: Date): Promise<number>;
  countIpSince(ipAddress: string, since: Date): Promise<number>;
  create(record: Omit<SmsChallengeRecord, "id" | "consumedAt">): Promise<SmsChallengeRecord>;
  consume(id: string, consumedAt: Date): Promise<boolean>;
}

export interface SmsProvider {
  sendCode(phoneNumber: string, code: string): Promise<void>;
  verifyCode?(phoneNumber: string, code: string): Promise<boolean>;
}

type SmsServiceOptions = {
  store: SmsChallengeStore;
  provider: SmsProvider;
  secret: string;
  now?: () => Date;
};

export class SmsService {
  private readonly now: () => Date;

  constructor(private readonly options: SmsServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  private hash(phoneNumber: string, code: string) {
    return createHmac("sha256", this.options.secret).update(`${phoneNumber}:${code}`).digest("hex");
  }

  async send(phoneNumber: string, ipAddress: string, code: string) {
    const parsed = phoneSchema.safeParse(phoneNumber);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
    if (!/^\d{6}$/.test(code)) throw new Error("验证码必须为 6 位数字");

    const now = this.now();
    const latest = await this.options.store.latest(phoneNumber);
    if (latest && now.getTime() - latest.createdAt.getTime() < 60_000) {
      throw new Error("发送过于频繁，请稍后再试");
    }
    const dayAgo = new Date(now.getTime() - 86_400_000);
    if (await this.options.store.countPhoneSince(phoneNumber, dayAgo) >= 10) {
      throw new Error("该手机号今日发送次数已达上限");
    }
    if (await this.options.store.countIpSince(ipAddress, dayAgo) >= 30) {
      throw new Error("当前网络今日发送次数已达上限");
    }

    await this.options.provider.sendCode(phoneNumber, code);
    return this.options.store.create({
      phoneNumber,
      codeHash: this.hash(phoneNumber, code),
      ipAddress,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 300_000),
    });
  }

  async verify(phoneNumber: string, code: string) {
    const challenge = await this.options.store.latest(phoneNumber);
    const now = this.now();
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= now) return false;
    if (this.options.provider.verifyCode) {
      if (!(await this.options.provider.verifyCode(phoneNumber, code))) return false;
      return this.options.store.consume(challenge.id, now);
    }
    const actual = Buffer.from(this.hash(phoneNumber, code), "hex");
    const expected = Buffer.from(challenge.codeHash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    return this.options.store.consume(challenge.id, now);
  }
}
