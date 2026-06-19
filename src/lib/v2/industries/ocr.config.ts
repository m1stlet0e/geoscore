import type { IndustryConfig } from '../types/industry'

/**
 * OCR (Optical Character Recognition) industry config.
 *
 * Narrow MVP target — 4 brands chosen for clear positioning:
 *   - TextIn (合合信息) — the focal brand for the demo
 *   - 腾讯云 OCR — incumbent
 *   - 百度智能云 OCR — incumbent
 *   - 阿里云 OCR — incumbent
 *
 * Dimension weights reflect what AI answers actually cite for OCR:
 *   doc 0.4    — official docs / API ref
 *   website 0.3 — marketing site, pricing, compare pages
 *   github 0.2  — sample code, sdk, demos
 *   zhihu 0.1   — chinese community Q&A
 */
export const ocrConfig: IndustryConfig = {
  industry: 'ocr',
  label: 'OCR · 文档识别',
  channels: ['deepseek', 'chatgpt'],

  brands: [
    {
      name: 'TextIn',
      aliases: ['TextIn', '合合 TextIn', '合合信息 TextIn', 'textin.com'],
      homepage: 'https://www.textin.com',
      github: 'intsig-textin/textin-python-sdk',
    },
    {
      name: '腾讯云 OCR',
      aliases: ['腾讯云 OCR', '腾讯 OCR', 'Tencent OCR', 'cloud.tencent.com/product/ocr'],
      homepage: 'https://cloud.tencent.com/product/ocr',
    },
    {
      name: '百度智能云 OCR',
      aliases: ['百度 OCR', '百度智能云 OCR', '百度文字识别', 'Baidu OCR', 'cloud.baidu.com/product/ocr'],
      homepage: 'https://cloud.baidu.com/product/ocr',
    },
    {
      name: '阿里云 OCR',
      aliases: ['阿里云 OCR', '阿里 OCR', 'Aliyun OCR', '读光 OCR'],
      homepage: 'https://www.aliyun.com/product/ai/ocr',
    },
  ],

  dimensionWeights: {
    doc: 0.4,
    website: 0.3,
    github: 0.2,
    zhihu: 0.1,
  },

  prompts: [
    // Recommendation prompts — high citation intent
    { text: '推荐几个好用的 OCR 文字识别 API', category: 'recommendation' },
    { text: '国内最好用的 OCR API 有哪些？', category: 'recommendation' },
    { text: '中文 OCR 哪家强？', category: 'recommendation' },
    { text: '文档 OCR 推荐', category: 'recommendation' },
    { text: '票据 OCR 识别推荐', category: 'recommendation' },
    { text: '身份证 OCR 识别 API 推荐', category: 'recommendation' },
    { text: '银行卡 OCR 识别哪个准', category: 'recommendation' },
    { text: '发票 OCR 识别 API 哪个好', category: 'recommendation' },
    { text: '手写体 OCR 推荐', category: 'recommendation' },
    { text: '英文 OCR API 推荐', category: 'recommendation' },

    // Comparison prompts — surfaces competitor naming
    { text: 'TextIn 和 百度 OCR 哪个更准', category: 'comparison' },
    { text: '腾讯 OCR 和 阿里 OCR 区别', category: 'comparison' },
    { text: 'TextIn 和 腾讯云 OCR 怎么选', category: 'comparison' },
    { text: '百度 OCR 和 阿里 OCR 哪个好', category: 'comparison' },
    { text: 'TextIn vs 百度 OCR vs 腾讯 OCR', category: 'comparison' },
    { text: 'TextIn 和 阿里云读光 哪个准', category: 'comparison' },
    { text: '国内 OCR 服务对比', category: 'comparison' },
    { text: 'OCR API 价格对比', category: 'comparison' },
    { text: '在线 OCR 工具对比', category: 'comparison' },
    { text: '通用 OCR 接口对比', category: 'comparison' },

    // Use-case prompts — long-tail, dimensional
    { text: 'PDF 解析 OCR 推荐', category: 'use_case' },
    { text: '表格识别 OCR 哪家强', category: 'use_case' },
    { text: '版面分析 OCR 推荐', category: 'use_case' },
    { text: '合同审阅 OCR 选什么', category: 'use_case' },
    { text: '医疗票据 OCR 推荐', category: 'use_case' },
    { text: '物流单据 OCR 推荐', category: 'use_case' },
    { text: '保险单 OCR 识别推荐', category: 'use_case' },
    { text: '证件 OCR 哪家好用', category: 'use_case' },
    { text: '试卷 OCR 识别推荐', category: 'use_case' },
    { text: '档案 OCR 数字化推荐', category: 'use_case' },

    // Technical prompts — github / doc surface
    { text: 'OCR API 文档示例', category: 'technical' },
    { text: 'OCR Python SDK 哪个好', category: 'technical' },
    { text: 'OCR Java 调用示例', category: 'technical' },
    { text: 'OCR Node.js SDK 推荐', category: 'technical' },
    { text: 'OCR REST API 怎么调用', category: 'technical' },
    { text: '免费 OCR API 推荐', category: 'technical' },
    { text: '开源 OCR 模型 vs 商用 API', category: 'technical' },
    { text: 'PaddleOCR 和商用 OCR API 对比', category: 'technical' },
    { text: 'Tesseract 和 TextIn 对比', category: 'technical' },
    { text: 'OCR API 准确率排行', category: 'technical' },

    // Buying prompts
    { text: 'OCR 服务怎么选', category: 'buying' },
    { text: 'OCR API 选型建议', category: 'buying' },
    { text: 'OCR 服务商推荐', category: 'buying' },
    { text: '企业级 OCR 推荐', category: 'buying' },
    { text: 'OCR SaaS 推荐', category: 'buying' },
    { text: 'OCR 接口供应商', category: 'buying' },
    { text: '国产 OCR 哪家好', category: 'buying' },
    { text: '高精度 OCR 服务推荐', category: 'buying' },
    { text: '低成本 OCR API 推荐', category: 'buying' },
    { text: '稳定的 OCR 服务推荐', category: 'buying' },
  ],
}
