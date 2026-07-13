import { webkit, devices } from "playwright";
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const logs = [];
page.on("console", m => logs.push(`[${m.type()}] ${m.text().slice(0,200)}`));
page.on("pageerror", e => logs.push(`[PAGEERROR] ${e.message.slice(0,300)}`));
page.on("requestfailed", r => logs.push(`[REQFAIL] ${r.url().slice(0,120)} ${r.failure()?.errorText}`));
const BASE = "http://10.0.0.183:3000";
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" }).catch(e=>logs.push("GOTO ERR "+e.message.slice(0,100)));
await page.waitForTimeout(2500);
const ctxInfo = await page.evaluate(() => ({
  secureContext: window.isSecureContext,
  subtle: !!(window.crypto && window.crypto.subtle),
  randomUUID: !!(window.crypto && window.crypto.randomUUID),
})).catch(e=>({err:e.message}));
console.log("CONTEXT:", JSON.stringify(ctxInfo));
// Is the login form interactive? type into email, see if value sticks (controlled input => needs hydration)
let typed = "n/a";
try { await page.fill('input[name="email"]', "x@y.com", {timeout:3000}); typed = await page.inputValue('input[name="email"]'); } catch(e){ typed = "FILL FAIL: "+e.message.slice(0,60); }
console.log("login email typed:", JSON.stringify(typed));
console.log("---- CONSOLE/ERRORS ----");
console.log(logs.slice(0,40).join("\n") || "(none)");
await browser.close();
