// ============================================
// 阿里云号码认证服务（Dypns）
// 功能：一键登录、本机号码校验、短信认证、人机验证
// 文档：https://help.aliyun.com/zh/pnvs/
// ============================================

import Dypnsapi20170525, * as dypns from '@alicloud/dypnsapi20170525'
import * as OpenApi from '@alicloud/openapi-client'
import * as crypto from 'crypto'

const ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || ''
const ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || ''
const DYPNS_SCHEME = process.env.DYPNS_SCHEME || 'geoscore'
const IS_DEV = process.env.NODE_ENV === 'development'

function createClient(): Dypnsapi20170525 {
  const config = new OpenApi.Config({
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
  })
  config.endpoint = 'dypnsapi.aliyuncs.com'
  return new Dypnsapi20170525(config)
}

// ============================================
// 一键登录 — H5 版本
// 流程：GetAuthToken → 跳转阿里 H5 页 → 回调 → GetMobile
// ============================================

export interface OneClickInitResult {
  accessToken: string
  jwtToken: string
  authUrl: string
}

export async function initOneClickLogin(serverCallbackUrl: string): Promise<OneClickInitResult | null> {
  if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) {
    if (IS_DEV) console.log('[DEV] One-click login skipped (no AK/SK)')
    return null
  }

  try {
    const client = createClient()
    const req = new dypns.GetAuthTokenRequest({
      origin: serverCallbackUrl,
      url: serverCallbackUrl,
      schemeName: DYPNS_SCHEME,
    })

    const resp = await client.getAuthToken(req)
    const data = resp.body?.tokenInfo
    if (!data?.accessToken || !data?.jwtToken) return null

    return {
      accessToken: data.accessToken,
      jwtToken: data.jwtToken,
      authUrl: `https://dypns.aliyuncs.com/auth/h5/getMobile?accessToken=${data.accessToken}&jwtToken=${data.jwtToken}`,
    }
  } catch (err) {
    console.error('[number-auth] GetAuthToken:', err)
    return null
  }
}

// ============================================
// 获取手机号 — 回调后调用
// ============================================

export async function getMobileFromToken(accessToken: string): Promise<string | null> {
  if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) return null

  try {
    const client = createClient()
    const req = new dypns.GetMobileRequest({ accessToken })
    const resp = await client.getMobile(req)

    if (resp.body?.code === 'OK' && resp.body.getMobileResultDTO?.mobile) {
      return resp.body.getMobileResultDTO.mobile
    }
    return null
  } catch (err) {
    console.error('[number-auth] GetMobile:', err)
    return null
  }
}

// ============================================
// 短信验证码发送 — 通过号码认证平台
// ============================================

export async function sendSmsViaDypns(
  phone: string,
  signName: string,
  templateCode: string,
  code: string
): Promise<boolean> {
  if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) {
    if (IS_DEV) return true
    return false
  }

  try {
    const client = createClient()
    const req = new dypns.VerifyMobileRequest({
      accessCode: code,
      phoneNumber: phone,
      outId: crypto.randomUUID(),
    })
    const resp = await client.verifyMobile(req)
    return resp.body?.code === 'OK'
  } catch (err) {
    console.error('[number-auth] SMS:', err)
    return false
  }
}

// ============================================
// 人机验证配置
// ============================================

export function getCaptchaConfig() {
  return {
    sceneId: process.env.CAPTCHA_SCENE_ID || '',
    prefix: process.env.CAPTCHA_PREFIX || 'geoscore',
  }
}
