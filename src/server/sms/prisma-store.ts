import { db } from "@/lib/db";
import type { SmsChallengeRecord, SmsChallengeStore } from "./service";

export class PrismaSmsChallengeStore implements SmsChallengeStore {
  latest(phoneNumber: string) {
    return db.smsChallenge.findFirst({ where: { phoneNumber }, orderBy: { createdAt: "desc" } });
  }

  countPhoneSince(phoneNumber: string, since: Date) {
    return db.smsChallenge.count({ where: { phoneNumber, createdAt: { gte: since } } });
  }

  countIpSince(ipAddress: string, since: Date) {
    return db.smsChallenge.count({ where: { ipAddress, createdAt: { gte: since } } });
  }

  create(record: Omit<SmsChallengeRecord, "id" | "consumedAt">) {
    return db.smsChallenge.create({ data: record });
  }

  async consume(id: string, consumedAt: Date) {
    const result = await db.smsChallenge.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt },
    });
    return result.count === 1;
  }
}
