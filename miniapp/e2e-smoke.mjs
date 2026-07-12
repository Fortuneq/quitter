// Смоук-тест механики: онбординг-квиз → пейволл → главный экран со стриком →
// урок дня → «Готово» → паник-кнопка → статистика.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4788'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

async function fail(msg) {
  await page.screenshot({ path: '/tmp/quitter-e2e-fail.png' })
  console.error('FAIL:', msg)
  await browser.close()
  process.exit(1)
}

// 1. Первый запуск → редирект на онбординг
await page.goto(`${BASE}/#/`)
try {
  await page.getByText('Как давно ты думаешь бросить?').waitFor({ timeout: 4000 })
} catch {
  await fail('нет первого экрана квиза')
}

// 2. Проходим квиз: choice-экраны кликаем по первому варианту,
// multi и инфо-экраны — по кнопке продолжения
const clicks = [
  () => page.locator('.quiz-option').first().click(), // thinking
  () => page.locator('.quiz-option').first().click(), // age
  () => page.locator('.quiz-option').first().click(), // started
  () => page.locator('.quiz-option').first().click(), // freq
  async () => {
    // symptoms (multi): выбираем два и жмём «Дальше»
    await page.locator('.quiz-option').nth(0).click()
    await page.locator('.quiz-option').nth(1).click()
    await page.getByRole('button', { name: 'Дальше' }).click()
  },
  () => page.locator('.quiz-option').first().click(), // attempts
  () => page.getByRole('button', { name: 'Понятно, что дальше?' }).click(), // shock
  () => page.getByRole('button', { name: 'Показать мой план' }).click(), // score
  () => page.getByRole('button', { name: 'Дальше' }).click(), // promise
  () => page.getByRole('button', { name: 'Дальше' }).click(), // reviews
]
for (const step of clicks) {
  await page.waitForTimeout(150)
  await step()
}
await page.getByRole('button', { name: 'Начать 90 дней' }).click()

// 3. Пейволл (после квиза) → «Позже»
try {
  await page.getByText('Твои 90 дней').waitFor({ timeout: 3000 })
} catch {
  await fail('нет пейволла после квиза')
}
await page.getByRole('button', { name: /Позже/ }).click()

// 4. Главный экран: стрик и урок дня
try {
  await page.locator('.ring__days').waitFor({ timeout: 3000 })
} catch {
  await fail('нет кольца стрика на главном экране')
}
await page.screenshot({ path: '/tmp/quitter-today.png' })

// 5. Урок дня → «Готово»
await page.locator('.lesson-card').click()
await page.getByRole('button', { name: 'Готово — я в деле' }).click()
await page.waitForTimeout(300)
const kicker = await page.locator('.lesson-card__kicker').textContent()
if (!kicker.includes('пройден')) await fail(`урок не отмечен: "${kicker}"`)

// 6. Паник-кнопка: дыхание → пропустить → написать → факт → «Я в порядке»
await page.getByRole('button', { name: 'Тянет? Жми сюда' }).click()
await page.getByText('Дыши со мной').waitFor({ timeout: 3000 })
await page.getByRole('button', { name: 'Пропустить' }).click()
await page.locator('.panic__input').fill('скука')
await page.getByRole('button', { name: 'Дальше' }).click()
await page.getByText('Холодный факт').waitFor({ timeout: 3000 })
await page.screenshot({ path: '/tmp/quitter-panic.png' })
await page.getByRole('button', { name: 'Я в порядке, отпустило' }).click()

// 7. Статистика после перезагрузки (localStorage должен сохраниться)
await page.goto(`${BASE}/#/stats`)
await page.reload()
await page.waitForTimeout(400)
const lessons = await page.locator('.stat-cell strong').nth(2).textContent()
if (lessons !== '1') await fail(`уроков = "${lessons}", ожидался 1`)
const panics = await page.locator('.stat-cell strong').nth(3).textContent()
if (panics !== '1') await fail(`паник = "${panics}", ожидалась 1`)
await page.screenshot({ path: '/tmp/quitter-stats.png' })

if (errors.length) await fail(`ошибки на странице:\n${errors.join('\n')}`)
console.log('OK: квиз → пейволл → урок → паника → статистика')
await browser.close()
