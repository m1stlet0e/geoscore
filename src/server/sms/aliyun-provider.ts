import DypnsClient, {
  CheckSmsVerifyCodeRequest,
  SendSmsVerifyCodeRequest,
} from "@alicloud/dypnsapi20170525";
import { Config } from "@alicloud/openapi-client";
import type { SmsProvider } from "./service";

export class AliyunSmsProvider implements SmsProvider {
  private readonly client: DypnsClient;

  constructor(
    accessKeyId: string,
    accessKeySecret: string,
    private readonly signName: string,
    private readonly templateCode: string,
  ) {
    this.client = new DypnsClient(new Config({
      accessKeyId,
      accessKeySecret,
      regionId: "cn-hangzhou",
    }));
  }

  async sendCode(phoneNumber: string) {
    const response = await this.client.sendSmsVerifyCode(
      new SendSmsVerifyCodeRequest({
        phoneNumber,
        countryCode: "86",
        signName: this.signName,
        templateCode: this.templateCode,
        templateParam: JSON.stringify({ code: "##code##", min: "5" }),
        codeLength: 6,
        codeType: 1,
        interval: 60,
        validTime: 300,
        duplicatePolicy: 1,
        returnVerifyCode: false,
      }),
    );
    if (!response.body?.success || response.body.code !== "OK") {
      throw new Error(response.body?.message ?? "阿里云短信发送失败");
    }
  }

  async verifyCode(phoneNumber: string, code: string) {
    const response = await this.client.checkSmsVerifyCode(
      new CheckSmsVerifyCodeRequest({
        phoneNumber,
        countryCode: "86",
        verifyCode: code,
      }),
    );
    return response.body?.success === true && response.body.model?.verifyResult === "PASS";
  }
}
