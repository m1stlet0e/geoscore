// ============================================
// 阿里云短信服务
// 文档：https://help.aliyun.com/product/44204.html
// ============================================

import Dysmsapi20170525, * as dysmsapi from '@alicloud/dysmsapi20170525'
import * as OpenApi from '@alicloud/openapi-client'
import * as Util from '@alicloud/openapi-client'

// 配置
const ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || ''
const ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || ''
const SIGN_NAME = process.env.SMS_SIGN_NAME || 'GeoScore'
const TEMPLATE_CODE = process.env.SMS_TEMPLATE_CODE || 'SMS_XXXXXXXX'

// 创建客户端
function createClient(): Dysmsapi20170525 {
  const config = new OpenApi.Config({
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
  })
  config.endpoint = 'dysmsapi.aliyuncs.com'
  return new Dysmsapi20170525(config)
}

// 发送短信验证码
export async function sendSmsCode(phone: string, code: string): Promise<boolean> {
  if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) {
    console.warn('SMS not configured, skipping send')
    // 开发模式下返回 true
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] SMS code for ${phone}: ${code}`)
      return true
    }
    return false
  }

  const client = createClient()
  
  const sendSmsRequest = new dysmsapi.SendSmsRequest({
    phoneNumbers: phone,
    signName: SIGN_NAME,
    templateCode: TEMPLATE_CODE,
    templateParam: JSON.stringify({ code }),
  })

  try {
    const response = await client.sendSms(sendSmsRequest)
    return response.body?.code === 'OK'
  } catch (error) {
    console.error('SMS send error:', error)
    return false
  }
}

// 生成 6 位验证码
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 验证码存储（Redis 或内存）
// 生产环境建议用 Redis
const codeStore = new Map<string, { code: string; expiresAt: number }>()

// 保存验证码
export function saveCode(phone: string, code: string): void {
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 分钟有效
  codeStore.set(phone, { code, expiresAt })
}

// 验证验证码
export function verifyCode(phone: string, code: string): boolean {
  const stored = codeStore.get(phone)
  if (!stored) return false
  
  if (Date.now() > stored.expiresAt) {
    codeStore.delete(phone)
    return false
  }
  
  if (stored.code !== code) return false
  
  // 验证成功后删除
  codeStore.delete(phone)
  return true
}

// 检查发送频率限制（1 分钟 1 条）
const lastSendTime = new Map<string, number>()

export function canSendCode(phone: string): boolean {
  const lastTime = lastSendTime.get(phone)
  if (!lastTime) return true
  
  const elapsed = Date.now() - lastTime
  return elapsed > 60 * 1000 // 1 分钟间隔
}

export function markCodeSent(phone: string): void {
  lastSendTime.set(phone, Date.now())
}
