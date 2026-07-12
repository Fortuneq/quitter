// Онбординг-квиз: главный конвертер. Каждый шаг — экран.
// type: choice | multi | info | score | promise | reviews | final
export const QUIZ = [
  {
    id: 'thinking',
    type: 'choice',
    title: 'Как давно ты думаешь бросить?',
    options: [
      { id: 'recent', label: 'Пару недель', note: 'Хорошо, что решил сразу' },
      { id: 'months', label: 'Несколько месяцев' },
      { id: 'year', label: 'Больше года', note: 'Ты не один — это большинство' },
      { id: 'years', label: 'Несколько лет', note: 'Пора заканчивать этот цикл' },
    ],
  },
  {
    id: 'age',
    type: 'choice',
    title: 'Сколько тебе лет?',
    options: [
      { id: 'lt18', label: 'До 18' },
      { id: '18-24', label: '18–24' },
      { id: '25-34', label: '25–34' },
      { id: '35+', label: '35+' },
    ],
  },
  {
    id: 'started',
    type: 'choice',
    title: 'Когда это началось?',
    options: [
      { id: 'school', label: 'Ещё в школе', note: 'Как у 76% ответивших' },
      { id: 'uni', label: 'В 18–25' },
      { id: 'later', label: 'Позже' },
    ],
  },
  {
    id: 'freq',
    type: 'choice',
    title: 'Как часто сейчас?',
    options: [
      { id: 'rare', label: 'Реже раза в неделю' },
      { id: 'weekly', label: '1–3 раза в неделю' },
      { id: 'daily', label: 'Почти каждый день' },
      { id: 'multi', label: 'Несколько раз в день' },
    ],
  },
  {
    id: 'symptoms',
    type: 'multi',
    title: 'Что замечаешь за собой?',
    subtitle: 'Выбери всё, что откликается',
    options: [
      { id: 'fog', label: 'Туман в голове' },
      { id: 'energy', label: 'Нет энергии' },
      { id: 'girls', label: 'Не интересны реальные девушки' },
      { id: 'procr', label: 'Прокрастинация' },
      { id: 'shame', label: 'Стыд после' },
      { id: 'scroll', label: 'Вечный скролл без удовольствия' },
    ],
  },
  {
    id: 'attempts',
    type: 'choice',
    title: 'Пробовал бросать?',
    options: [
      { id: 'never', label: 'Ни разу' },
      { id: 'few', label: '1–2 раза' },
      { id: 'some', label: '3–6 раз' },
      { id: 'many', label: '7+ раз', note: 'Без системы это нормально' },
    ],
  },
  {
    id: 'shock',
    type: 'info',
    title: 'Почему сила воли не работает',
    // Текст собирается динамически из ответов (см. Onboarding.jsx)
  },
  {
    id: 'score',
    type: 'score',
    title: 'Твой уровень перегрузки',
  },
  {
    id: 'promise',
    type: 'promise',
    title: 'Твои 90 дней',
  },
  {
    id: 'reviews',
    type: 'reviews',
    title: 'Это работает',
  },
  {
    id: 'final',
    type: 'final',
    title: 'Твой план готов',
  },
]

export const REVIEWS = [
  {
    name: 'Аноним, 24',
    days: 63,
    text: 'Через три недели заметил, что утром встаю без будильника. Туман в голове ушёл — как будто резкость навели.',
  },
  {
    name: 'Аноним, 29',
    days: 90,
    text: 'Срывался семь лет подряд. Помог план по дням и паник-кнопка ночью. После 90 дней просто не тянет.',
  },
  {
    name: 'Аноним, 21',
    days: 45,
    text: 'Первый раз в жизни подошёл познакомиться вживую. Уверенность реально возвращается, это не сказки.',
  },
]

// Оценка «перегрузки» 1–10 из ответов квиза — для экрана скоринга
export function computeScore(answers) {
  let score = 4
  const freq = answers.freq
  if (freq === 'weekly') score += 1.5
  if (freq === 'daily') score += 3
  if (freq === 'multi') score += 4
  score += Math.min(2, (answers.symptoms?.length ?? 0) * 0.4)
  if (answers.started === 'school') score += 0.5
  if (answers.attempts === 'many') score += 0.5
  return Math.min(9.8, Math.round(score * 10) / 10)
}

// Сколько лет «в цикле» — для шок-экрана
export function yearsInLoop(answers) {
  if (answers.started === 'school') return answers.age === '18-24' ? 8 : 12
  if (answers.started === 'uni') return answers.age === '25-34' ? 7 : 4
  return 3
}
