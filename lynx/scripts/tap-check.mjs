import { webkit, devices } from "playwright";
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/login");
await page.fill('input[name="email"]', "pkm-tester@example.com");
await page.fill('input[name="password"]', "Test123456!");
await page.tap('button[type="submit"]');
await page.waitForURL(/\/notes/, { timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(1500);

const gear = page.locator('button[aria-label="Open settings"]');
const box = await gear.boundingBox();
console.log("gear box:", JSON.stringify(box));
const info = await page.evaluate((b) => {
  if (!b) return "no box";
  const x = b.x + b.width/2, y = b.y + b.height/2;
  const el = document.elementFromPoint(x, y);
  let chain = []; let e = el;
  while (e && chain.length < 4) { chain.push(e.tagName + (e.getAttribute("aria-label")?("["+e.getAttribute("aria-label")+"]"):"") + "." + String(e.className||"").slice(0,40)); e = e.parentElement; }
  return { x, y, topElementChain: chain };
}, box);
console.log("at gear center:", JSON.stringify(info, null, 0));
let opened = false;
try { await gear.tap({ timeout: 3000 }); await page.waitForTimeout(400); opened = await page.locator('text=Appearance').first().isVisible().catch(()=>false); } catch(e) { console.log("tap error:", e.message.slice(0,100)); }
console.log("settings drawer opened:", opened);
await browser.close();
