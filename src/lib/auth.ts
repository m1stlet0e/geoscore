import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { db } from "@/lib/db";
import { smsService } from "@/server/sms";

export const auth = betterAuth({
  appName: "GeoScore",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const freePlan = await db.plan.findUnique({ where: { code: "FREE" } });
          if (!freePlan) throw new Error("FREE 套餐尚未初始化");
          const now = new Date();
          const endsAt = new Date(now);
          endsAt.setFullYear(endsAt.getFullYear() + 10);
          await db.$transaction([
            db.quotaAccount.upsert({
              where: { userId: user.id },
              update: {},
              create: { userId: user.id, balance: freePlan.monthlyResponses },
            }),
            db.subscription.create({
              data: {
                userId: user.id,
                planId: freePlan.id,
                startsAt: now,
                endsAt,
              },
            }),
            db.quotaLedger.upsert({
              where: { idempotencyKey: `signup:${user.id}` },
              update: {},
              create: {
                userId: user.id,
                type: "GRANT",
                amount: freePlan.monthlyResponses,
                balanceAfter: freePlan.monthlyResponses,
                referenceType: "SIGNUP",
                referenceId: user.id,
                idempotencyKey: `signup:${user.id}`,
              },
            }),
          ]);
        },
      },
    },
  },
  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      requireVerification: true,
      phoneNumberValidator: (value) => /^1[3-9]\d{9}$/.test(value),
      sendOTP: async ({ phoneNumber, code }, ctx) => {
        const ipAddress = ctx?.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? ctx?.request?.headers.get("x-real-ip")
          ?? "unknown";
        const codeToSend = process.env.SMS_PROVIDER === "mock"
          ? (process.env.SMS_TEST_CODE ?? "888888")
          : code;
        await smsService.send(phoneNumber, ipAddress, codeToSend);
      },
      verifyOTP: ({ phoneNumber, code }) => smsService.verify(phoneNumber, code),
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone}@phone.geoscore.cn`,
        getTempName: (phone) => `用户${phone.slice(-4)}`,
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
