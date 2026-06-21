// ============================================
// 短信验证码服务 — 阿里云 Dypns 短信认证
// 个人开发者可用，不需要企业资质
// 文档：https://help.aliyun.com/zh/pnvs/product-overview/message-authentication
// ============================================

import Dypnsapi20170525, * as dypns from '@alicloud/dypnsapi20170525'
import * as OpenApi from '@alicloud/openapi-client'

const IS_DEV = process.env.NODE_ENV === 'development'
const ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || ''
const ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || ''

// Dypns 短信认证方案参数（在控制台「短信认证」创建方案后获得）
const DYPNS_SIGN_NAME = process.env.DYPNS_SIGN_NAME || ''
const DYPNS_TEMPLATE_CODE = process.env.DYPNS_TEMPLATE_CODE || ''
const DYPNS_SCHEME_NAME = process.env.DYPNS_SCHEME_NAME || ''

function createClient(): Dypnsapi20170525 {
  const config = new OpenApi.Config({
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
  })
  config.endpoint = 'dypnsapi.aliyuncs.com'
  return new Dypnsapi20170525(config)
}

/**
 * 发送短信验证码（通过 Dypns 短信认证，个人可用，无需企业资质）
 * 返回 { success, bizId }
 */
export async function sendSmsCode(
  phone: string,
): Promise<{ success: boolean; bizId?: string }> {
  // 开发环境：未配置阿里云时直接放行，由 send-code API 生成调试验证码
  if (IS_DEV && (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET)) {
    console.log(`[DEV] SMS would be sent to ${phone} (no AK/SK configured)`)
    return { success: true }
  }

  if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) {
    console.error('[sms] 未配置 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET')
    return { success: false }
  }

  if (!DYPNS_SIGN_NAME || !DYPNS_TEMPLATE_CODE) {
    console.error(
      '[sms] 未配置 DYPNS_SIGN_NAME / DYPNS_TEMPLATE_CODE — 请先在 Dypns 控制台「短信认证」创建方案',
    )
    return { success: false }
  }

  try {
    const client = createClient()
    const req = new dypns.SendSmsVerifyCodeRequest({
      phoneNumber: phone,
      signName: DYPNS_SIGN_NAME,
      templateCode: DYPNS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code: '##code##' }),
      schemeName: DYPNS_SCHEME_NAME || undefined,
      codeLength: 6,
      codeType: 1, // 纯数字
      validTime: 300, // 5 分钟
      interval: 60, // 60 秒内同号只发一条
      returnVerifyCode: false, // 生产环境不返回验证码明文
    })

    const resp = await client.sendSmsVerifyCode(req)

    if (resp.body?.code === 'OK') {
      return { success: true, bizId: resp.body.model?.bizId }
    }

    console.error('[sms] sendSmsVerifyCode 失败:', resp.body?.code, resp.body?.message)
    return { success: false }
  } catch (err) {
    console.error('[sms] sendSmsVerifyCode 异常:', err)
    return { success: false }
  }
}

/**
 * 核验短信验证码（通过 Dypns 短信认证）
 * 返回 true 表示验证通过
 */
export async function verifySmsCode(phone: string, code: string): Promise<boolean> {
  // 开发环境：未配置阿里云时跳过核验（由 phone-login API 用万能码或 DB 核验）
  if (IS_DEV && (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET)) {
    console.log(`[DEV] Dypns verify skipped for ${phone}, code=${code}`)
    return true
  }

  if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) {
    console.error('[sms] 未配置 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET')
    return false
  }

  try {
    const client = createClient()
    const req = new dypns.CheckSmsVerifyCodeRequest({
      phoneNumber: phone,
      verifyCode: code,
      schemeName: DYPNS_SCHEME_NAME || undefined,
    })

    const resp = await client.checkSmsVerifyCode(req)

    if (resp.body?.code === 'OK') {
      return true
    }

    console.error('[sms] checkSmsVerifyCode 失败:', resp.body?.code, resp.body?.message)
    return false
  } catch (err) {
    console.error('[sms] checkSmsVerifyCode 异常:', err)
    return false
  }
}

/**
 * 生成本地验证码（仅开发环境使用）
 */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
