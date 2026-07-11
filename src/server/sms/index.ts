import { AliyunSmsProvider } from "./aliyun-provider";
import { MockSmsProvider } from "./mock-provider";
import { PrismaSmsChallengeStore } from "./prisma-store";
import { SmsService, type SmsProvider } from "./service";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

function createProvider(): SmsProvider {
  if (process.env.SMS_PROVIDER === "aliyun") {
    return new AliyunSmsProvider(
      required("ALIBABA_CLOUD_ACCESS_KEY_ID"),
      required("ALIBABA_CLOUD_ACCESS_KEY_SECRET"),
      required("ALIYUN_SMS_SIGN_NAME"),
      required("ALIYUN_SMS_TEMPLATE_CODE"),
    );
  }
  return new MockSmsProvider();
}

export const smsService = new SmsService({
  store: new PrismaSmsChallengeStore(),
  provider: createProvider(),
  secret: required("BETTER_AUTH_SECRET"),
});
