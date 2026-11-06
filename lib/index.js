/**
 * Host half of dsh-whale-recipe.
 *
 * 只做一件事：在每个 index.html 响应里注入两行 ——
 *   1. 一段 <style>：页面上那颗悬浮按钮的定位与层级；
 *   2. 一段 <script>：把 CSS、菜谱数据（含图片 data URI）和面板脚本压成一次求值。
 *
 * 为什么不用 dsh.client：客户端半边要打包并注入一堆 @deepseek-ai/dsh-client-* 服务，
 * 为本插件这点 UI 不值得。index 注入是纯组合事件，没有 Service 依赖，装配零成本，
 * 也不受客户端 bundle 版本约束。
 *
 * @module dsh-whale-recipe
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const name = 'whale-recipe'

/** 读不到就直接降级成一个没有面板的 DSH，不抛错。 */
function read(file) {
  try {
    return readFileSync(join(here, file), 'utf8')
  } catch {
    return null
  }
}

let warned = false

export function apply(ctx) {
  ctx.on('webserver/index-inject', (table) => {
    if (table === null || typeof table !== 'object' || typeof table.push !== 'function') {
      if (!warned) {
        warned = true
        console.warn('[whale-recipe] webserver/index-inject no longer hands out a row table; panel disabled on this host')
      }
      return
    }

    const bootCss = read('boot.css')
    const panelCss = read('panel.css')
    const data = read('data.js')
    const panelJs = read('panel.js')
    if (panelCss === null || panelJs === null) return

    if (bootCss !== null) table.push({ kind: 'style', text: bootCss })

    // 数据先赋给全局，再执行面板脚本：顺序是字符串的属性，不依赖行的排列。
    table.push({
      kind: 'script',
      placement: 'head',
      text:
        'window.__WHALE_RECIPE_CSS__=' + JSON.stringify(panelCss) + ';' +
        (data === null ? 'window.__WHALE_RECIPE__={dishes:[],pics:{}};' : data) +
        panelJs,
    })
  })
}
