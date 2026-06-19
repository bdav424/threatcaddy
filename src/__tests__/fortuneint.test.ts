import { describe, expect, it } from 'vitest';
import {
  buildFortuneIntIntro,
  buildFortuneIntReading,
  FORTUNE_INT_TYPES,
  getFortuneIntChoiceCategory,
  getFortuneIntCycleKey,
  getFortuneIntDailyChoices,
  getFortuneIntNextReset,
  isFortuneIntCommand,
} from '../lib/fortuneint';

function findFirstDateForCategory(categoryId: 'objects' | 'virtues' | 'colors'): Date {
  for (let offset = 0; offset < 120; offset += 1) {
    const date = new Date(2026, 0, 1 + offset, 10, 0, 0, 0);
    if (getFortuneIntChoiceCategory(date).id === categoryId) {
      return date;
    }
  }

  throw new Error(`Could not find first ${categoryId} date`);
}

describe('fortuneint', () => {
  it('detects the fortuneint slash command', () => {
    expect(isFortuneIntCommand('/fortuneint')).toBe(true);
    expect(isFortuneIntCommand('/fortuneint please')).toBe(true);
    expect(isFortuneIntCommand('/forecast')).toBe(false);
  });

  it('uses the previous day cycle before the 6am reset', () => {
    expect(getFortuneIntCycleKey(new Date('2026-06-02T05:59:00'))).toBe('2026-06-01');
    expect(getFortuneIntCycleKey(new Date('2026-06-02T06:00:00'))).toBe('2026-06-02');
  });

  it('returns a deterministic daily category and token set', () => {
    const dateA = new Date('2026-06-02T10:00:00');
    const dateB = new Date('2026-06-02T18:00:00');
    const categoryA = getFortuneIntChoiceCategory(dateA);
    const categoryB = getFortuneIntChoiceCategory(dateB);
    const choicesA = getFortuneIntDailyChoices(dateA);
    const choicesB = getFortuneIntDailyChoices(dateB);

    expect(categoryA).toEqual(categoryB);
    expect(choicesA).toEqual(choicesB);
    expect(choicesA).toHaveLength(3);
    expect(new Set(choicesA.map((choice) => choice.category))).toEqual(new Set([categoryA.id]));
  });

  it('balances categories evenly over longer stretches', () => {
    const counts = { objects: 0, virtues: 0, colors: 0 };

    for (let day = 0; day < 18; day += 1) {
      const category = getFortuneIntChoiceCategory(new Date(2026, 0, 1 + day, 10, 0, 0, 0)).id;
      counts[category] += 1;
    }

    expect(counts).toEqual({ objects: 6, virtues: 6, colors: 6 });
  });

  it('avoids early object repeats across the first three object appearances', () => {
    const startDate = findFirstDateForCategory('objects');
    const objectDates: Date[] = [];
    const seen = new Set<string>();

    for (let offset = 0; objectDates.length < 3 && offset < 30; offset += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + offset);
      if (getFortuneIntChoiceCategory(date).id === 'objects') {
        objectDates.push(date);
      }
    }

    expect(objectDates).toHaveLength(3);

    for (const date of objectDates) {
      const choices = getFortuneIntDailyChoices(date);
      for (const choice of choices) {
        expect(seen.has(choice.id)).toBe(false);
        seen.add(choice.id);
      }
    }

    expect(seen.size).toBe(9);
  });

  it('builds the intro prompt for the current cycle with category context', () => {
    const intro = buildFortuneIntIntro(new Date('2026-06-02T10:00:00'));
    expect(intro.cycleKey).toBe('2026-06-02');
    expect(intro.invocation.length).toBeGreaterThan(10);
    expect(intro.subtitle.length).toBeGreaterThan(10);
    expect(['objects', 'virtues', 'colors']).toContain(intro.category.id);
  });

  it('builds deterministic readings for the same type and token', () => {
    const token = getFortuneIntDailyChoices(new Date('2026-06-02T10:00:00'))[0];
    const first = buildFortuneIntReading(FORTUNE_INT_TYPES[1].id, token.id, 'Red Kite', new Date('2026-06-02T10:00:00'));
    const second = buildFortuneIntReading(FORTUNE_INT_TYPES[1].id, token.id, 'Red Kite', new Date('2026-06-02T10:00:00'));
    expect(first).toEqual(second);
    expect(first.typeLabel).toBe(FORTUNE_INT_TYPES[1].label);
    expect(first.choiceLabel).toBe(token.label);
    expect(first.categoryId).toBe(token.category);
    expect(first.investigationFlavor).toBe('Red Kite');
  });

  it('changes the fortune text when the day changes for the same type and token', () => {
    const token = getFortuneIntDailyChoices(new Date('2026-06-02T10:00:00'))[0];
    const first = buildFortuneIntReading(FORTUNE_INT_TYPES[0].id, token.id, 'Red Kite', new Date('2026-06-02T10:00:00'));
    const second = buildFortuneIntReading(FORTUNE_INT_TYPES[0].id, token.id, 'Red Kite', new Date('2026-06-03T10:00:00'));

    expect(second.cycleKey).not.toBe(first.cycleKey);
    expect([
      second.headline !== first.headline,
      second.omen !== first.omen,
      second.watchFor !== first.watchFor,
      second.ritual !== first.ritual,
    ].some(Boolean)).toBe(true);
  });

  it('computes the next reset time at 6am local time', () => {
    expect(getFortuneIntNextReset(new Date('2026-06-02T05:59:00'))).toBe(new Date('2026-06-02T06:00:00').getTime());
    expect(getFortuneIntNextReset(new Date('2026-06-02T10:00:00'))).toBe(new Date('2026-06-03T06:00:00').getTime());
  });
});
