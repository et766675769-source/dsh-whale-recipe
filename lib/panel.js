/* 面板半边：在 shadow root 里渲染悬浮菜谱墙。宿主只负责注入，不参与渲染。 */
(function () {
  if (window.__whaleRecipeBooted) return
  window.__whaleRecipeBooted = true

  var DATA = window.__WHALE_RECIPE__ || { dishes: [], pics: {} }
  var dishes = Array.isArray(DATA.dishes) ? DATA.dishes : []
  var pics = DATA.pics || {}
  var BUCKETS = ['全部', '大米饭', '中餐', '西餐', '饮品\\甜品']
  var KEYS = [['sweet', '甜'], ['sour', '酸'], ['salty', '咸'], ['umami', '鲜'], ['bitter', '苦']]

  var host = document.createElement('div')
  host.id = 'whale-recipe-host'
  document.documentElement.appendChild(host)
  var root = host.attachShadow({ mode: 'open' })
  var style = document.createElement('style')
  style.textContent = window.__WHALE_RECIPE_CSS__ || ''
  root.appendChild(style)

  var fab = document.createElement('button')
  fab.className = 'fab'
  fab.type = 'button'
  fab.title = '鲸鱼娘食谱'
  fab.setAttribute('aria-label', '鲸鱼娘食谱')
  fab.textContent = '🐳'
  root.appendChild(fab)

  var panel = document.createElement('div')
  panel.className = 'panel'
  root.appendChild(panel)

  var filter = '全部'
  var currentId = null
  var toastTimer = null

  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  function toast(msg, bad) {
    var t = panel.querySelector('.toast')
    if (!t) return
    t.textContent = msg
    t.className = 'toast' + (bad ? ' err' : '')
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(function () {
      if (t) t.textContent = ''
    }, 4200)
  }

  function pool() {
    if (filter === '全部') return dishes
    return dishes.filter(function (d) { return d.b === filter })
  }

  function findDish(id) {
    for (var i = 0; i < dishes.length; i++) if (dishes[i].id === id) return dishes[i]
    return null
  }

  function pngUri(dish) {
    return pics[dish.id] || ''
  }

  function fileName(dish) {
    return (dish.n || dish.id) + '.png'
  }

  function legacyCopy(uri, done) {
    var wrap = document.createElement('div')
    wrap.contentEditable = 'true'
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:160px;height:160px;overflow:hidden;'
    var img = document.createElement('img')
    img.src = uri
    img.width = 160
    img.height = 160
    wrap.appendChild(img)
    root.appendChild(wrap)
    var ok = false
    try {
      var range = document.createRange()
      range.selectNodeContents(wrap)
      var sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      ok = document.execCommand('copy')
      sel.removeAllRanges()
    } catch (e) { ok = false }
    root.removeChild(wrap)
    done(ok)
  }

  function copyDish(dish, btn) {
    var uri = pngUri(dish)
    if (!uri) { toast('这道菜还没有插画', true); return }
    if (btn) btn.disabled = true
    var finish = function (ok) {
      if (btn) btn.disabled = false
      toast(ok ? ('已复制「' + dish.n + '」，Ctrl+V 贴到微信/QQ') : '复制失败，请用「存图」', !ok)
    }
    if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
      fetch(uri).then(function (r) { return r.blob() }).then(function (blob) {
        return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      }).then(function () { finish(true) }).catch(function () { legacyCopy(uri, finish) })
    } else {
      legacyCopy(uri, finish)
    }
  }

  function onDrag(e, dish) {
    var uri = pngUri(dish)
    if (!uri) return
    try {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('DownloadURL', 'image/png:' + fileName(dish) + ':' + uri)
      e.dataTransfer.setData('text/uri-list', uri)
      e.dataTransfer.setData('text/plain', '🐳 投喂：' + dish.n)
    } catch (err) { /* 某些宿主禁用自定义 payload */ }
  }

  function renderDetail(dish) {
    panel.innerHTML = ''
    var wrap = el('div', 'detail')

    var head = el('div', 'dhead')
    var back = el('button', 'back', '← 菜谱墙')
    back.type = 'button'
    back.onclick = function () { currentId = null; render() }
    head.appendChild(el('div', 'dname', dish.n))
    head.appendChild(back)
    wrap.appendChild(head)

    var meta = [dish.b]
    if (dish.ph != null) meta.push('pH ' + dish.ph)
    if (dish.q != null) meta.push(dish.q + ' kg')
    if (dish.c) meta.push('原标签 ' + dish.c)
    wrap.appendChild(el('div', 'dmeta', meta.join(' · ')))

    var img = el('img', 'dimg')
    img.src = pngUri(dish)
    img.alt = dish.n
    if (!pngUri(dish)) img.style.display = 'none'
    wrap.appendChild(img)

    var bars = el('div', 'bars')
    var p = dish.p || {}
    KEYS.forEach(function (pair) {
      var v = Number(p[pair[0]]) || 0
      var row = el('div', 'brow')
      row.appendChild(el('span', 'bl', pair[1]))
      var bar = el('i')
      bar.style.width = Math.max(0, Math.min(100, (v / 0.5) * 100)).toFixed(1) + '%'
      row.appendChild(bar)
      row.appendChild(el('b', null, v.toFixed(2)))
      bars.appendChild(row)
    })
    wrap.appendChild(bars)

    if (Array.isArray(dish.t) && dish.t.length) {
      var food = dish.t.slice(1)
      var lo = Math.min.apply(null, food)
      var hi = Math.max.apply(null, food)
      wrap.appendChild(el('div', 'hint',
        '入口 ' + food[0].toFixed(0) + '℃ → 回味 ' + food[food.length - 1].toFixed(0) + '℃ · ' +
        '食物温度 ' + lo.toFixed(0) + '℃ ~ ' + hi.toFixed(0) + '℃'))
    }
    if (dish.x && dish.x.length) {
      wrap.appendChild(el('div', 'hint', '质地：' + dish.x.map(function (e) { return e.k + ' ' + e.v }).join(' · ')))
    }
    if (dish.a && dish.a.length) {
      wrap.appendChild(el('div', 'hint', '香气：' + dish.a.map(function (e) { return e.k + ' ' + e.v }).join(' · ')))
    }

    var row = el('div', 'row')
    var cp = el('button', 'btn primary', '复制图片')
    cp.type = 'button'
    cp.onclick = function () { copyDish(dish, cp) }
    row.appendChild(cp)

    var save = el('a', 'btn', '存图')
    save.download = fileName(dish)
    save.href = pngUri(dish) || '#'
    row.appendChild(save)
    wrap.appendChild(row)

    wrap.appendChild(el('div', 'toast'))
    wrap.appendChild(el('div', 'hint', '拖进 QQ 可直接发送；微信请先复制再粘贴。'))
    panel.appendChild(wrap)
  }

  function renderWall() {
    panel.innerHTML = ''

    panel.appendChild(el('div', 'usage', '点卡片看参数 · 悬停「复制」可贴微信 · 拖进 QQ 直接投喂'))

    var chips = el('div', 'chips')
    BUCKETS.forEach(function (b) {
      var n = b === '全部' ? dishes.length : dishes.filter(function (d) { return d.b === b }).length
      var chip = el('button', 'chip' + (b === filter ? ' on' : ''), b + ' ' + n)
      chip.type = 'button'
      chip.onclick = function () { filter = b; renderWall() }
      chips.appendChild(chip)
    })
    panel.appendChild(chips)

    var wall = el('div', 'wall')
    var list = pool()
    if (!list.length) {
      wall.appendChild(el('div', 'hint', '这个分类下没有菜。'))
    }
    list.forEach(function (dish) {
      var card = el('div', 'card')
      card.draggable = true
      card.title = '点开看参数 · 拖动可投喂'

      var img = el('img')
      img.src = pngUri(dish)
      img.alt = dish.n
      img.loading = 'lazy'
      card.appendChild(img)
      card.appendChild(el('div', 'nm', dish.n))

      var cp = el('button', 'cp', '复制')
      cp.type = 'button'
      cp.onclick = function (e) { e.stopPropagation(); copyDish(dish, cp) }
      card.appendChild(cp)

      card.addEventListener('dragstart', function (e) { onDrag(e, dish) })
      card.addEventListener('click', function () { currentId = dish.id; render() })
      wall.appendChild(card)
    })
    panel.appendChild(wall)

    var toastEl = el('div', 'toast')
    panel.appendChild(toastEl)
  }

  function render() {
    var dish = currentId ? findDish(currentId) : null
    if (dish) renderDetail(dish)
    else renderWall()
  }

  fab.onclick = function () {
    var open = panel.classList.toggle('open')
    fab.classList.toggle('on', open)
    if (open) render()
  }

  render()
})()
