import { chromium } from 'playwright-core'
const D = process.env.SHOTDIR
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 390, height: 700 } })
await p.goto('http://localhost:3216/test-carousel', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(11000)
await p.mouse.click(195, 420)
await p.waitForTimeout(1400)
await p.screenshot({ path: D + '/r2-zoom.png' })
await p.mouse.move(90, 400); await p.mouse.down()
for (let x = 90; x <= 310; x += 20) { await p.mouse.move(x, 400); await p.waitForTimeout(28) }
await p.screenshot({ path: D + '/r3-midswipe.png' })
await p.mouse.up()
await p.waitForTimeout(2200)
const ev = await p.locator('#ev').textContent()
console.log('EVENTS:', ev)
await b.close()
