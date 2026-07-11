import type { SmsProvider } from "./service";

export class MockSmsProvider implements SmsProvider {
  async sendCode() {
    // 本地验证码由 SmsService 哈希保存，不向外部发送。
  }
}
