// План 90 дней: короткий урок + микрозадание на каждый день.
import part1 from './lessons-1.json'
import part2 from './lessons-2.json'
import part3 from './lessons-3.json'

export const LESSONS = [...part1, ...part2, ...part3]

export function lessonByDay(day) {
  return LESSONS.find((l) => l.day === day) ?? null
}
