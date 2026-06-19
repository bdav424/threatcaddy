export interface FortuneIntChoice {
  id: string;
  label: string;
  accent: string;
  category: FortuneIntChoiceCategory;
}

export interface FortuneIntType {
  id: string;
  label: string;
}

export type FortuneIntChoiceCategory = 'objects' | 'virtues' | 'colors';

export interface FortuneIntChoiceCategoryMeta {
  id: FortuneIntChoiceCategory;
  label: string;
  introLabel: string;
  promptLabel: string;
}

export interface FortuneIntReading {
  cycleKey: string;
  typeId: string;
  typeLabel: string;
  categoryId: FortuneIntChoiceCategory;
  categoryLabel: string;
  categoryPrompt: string;
  choiceId: string;
  choiceLabel: string;
  invocation: string;
  subtitle: string;
  weekdayFlavor?: string;
  headline: string;
  omen: string;
  watchFor: string;
  ritual: string;
  closing: string;
  investigationFlavor?: string;
  generatedAt: number;
  nextResetAt: number;
}

export interface FortuneIntStoredReading {
  cycleKey: string;
  choiceId: string;
  reading: FortuneIntReading;
  selectedAt: number;
}

const RESET_HOUR = 6;

const INVOCATIONS = [
  'You seek the future, and I will provide the answers you seek.',
  'Speak, analyst. The crystal is listening for the signal beneath the static.',
  'Step closer. The veil is thin, and the telemetry is in a talkative mood.',
  'Ask for tomorrow softly. FortuneINT prefers intrigue over certainty.',
];

const SUBTITLES = [
  'Choose one token for today. The reading is granted once, then sealed until dawn.',
  'Select the omen that calls to you. The crystal opens only once each cycle.',
  'Pick your symbol with care. After one reading, the curtain falls until morning.',
];

const DAILY_CHOICE_COUNT = 3;

export const FORTUNE_INT_TYPES: FortuneIntType[] = [
  { id: 'watchfor', label: 'What should I watch for?' },
  { id: 'posture', label: 'How should I carry myself?' },
  { id: 'weirdness', label: 'Where is the weirdness hiding?' },
];

export const FORTUNE_INT_CATEGORIES: FortuneIntChoiceCategoryMeta[] = [
  { id: 'objects', label: 'Objects', introLabel: 'The table offers objects today.', promptLabel: 'Choose an object' },
  { id: 'virtues', label: 'Virtues', introLabel: 'The table offers virtues today.', promptLabel: 'Choose a virtue' },
  { id: 'colors', label: 'Colors', introLabel: 'The table offers colors today.', promptLabel: 'Choose a color' },
];

const CHOICE_POOLS: Record<FortuneIntChoiceCategory, FortuneIntChoice[]> = {
  objects: [
    { id: 'thread', label: 'Thread', accent: 'from-rose-300/25 to-pink-500/20', category: 'objects' },
    { id: 'coin', label: 'Coin', accent: 'from-yellow-300/25 to-orange-500/20', category: 'objects' },
    { id: 'key', label: 'Key', accent: 'from-stone-300/25 to-orange-400/20', category: 'objects' },
    { id: 'lantern', label: 'Lantern', accent: 'from-amber-300/25 to-yellow-500/20', category: 'objects' },
    { id: 'ruler', label: 'Ruler', accent: 'from-slate-300/25 to-cyan-500/20', category: 'objects' },
    { id: 'needle', label: 'Needle', accent: 'from-zinc-200/25 to-slate-400/20', category: 'objects' },
    { id: 'scissors', label: 'Scissors', accent: 'from-stone-300/25 to-zinc-500/20', category: 'objects' },
    { id: 'shield', label: 'Shield', accent: 'from-slate-300/25 to-sky-500/20', category: 'objects' },
    { id: 'book', label: 'Book', accent: 'from-blue-400/25 to-indigo-500/20', category: 'objects' },
    { id: 'pencil', label: 'Pencil', accent: 'from-amber-300/25 to-orange-400/20', category: 'objects' },
    { id: 'bow', label: 'Bow', accent: 'from-amber-400/25 to-red-500/20', category: 'objects' },
    { id: 'arrow', label: 'Arrow', accent: 'from-slate-300/25 to-rose-500/20', category: 'objects' },
    { id: 'compass', label: 'Compass', accent: 'from-teal-300/25 to-cyan-500/20', category: 'objects' },
    { id: 'mirror', label: 'Mirror', accent: 'from-zinc-200/25 to-slate-400/20', category: 'objects' },
    { id: 'crown', label: 'Crown', accent: 'from-yellow-300/25 to-amber-500/20', category: 'objects' },
    { id: 'bell', label: 'Bell', accent: 'from-amber-200/25 to-yellow-400/20', category: 'objects' },
    { id: 'leaf', label: 'Leaf', accent: 'from-emerald-400/25 to-lime-500/20', category: 'objects' },
    { id: 'brick', label: 'Brick', accent: 'from-rose-500/25 to-orange-500/20', category: 'objects' },
    { id: 'ring', label: 'Ring', accent: 'from-yellow-200/25 to-stone-400/20', category: 'objects' },
    { id: 'seal', label: 'Seal', accent: 'from-red-400/25 to-rose-500/20', category: 'objects' },
    { id: 'torch', label: 'Torch', accent: 'from-orange-500/25 to-amber-500/20', category: 'objects' },
    { id: 'rope', label: 'Rope', accent: 'from-stone-400/25 to-amber-600/20', category: 'objects' },
    { id: 'feather', label: 'Feather', accent: 'from-slate-100/30 to-sky-300/20', category: 'objects' },
    { id: 'stone', label: 'Stone', accent: 'from-zinc-400/25 to-slate-600/20', category: 'objects' },
    { id: 'anchor', label: 'Anchor', accent: 'from-sky-400/25 to-blue-700/20', category: 'objects' },
    { id: 'cup', label: 'Cup', accent: 'from-amber-200/25 to-orange-400/20', category: 'objects' },
    { id: 'drum', label: 'Drum', accent: 'from-red-500/25 to-orange-500/20', category: 'objects' },
    { id: 'map', label: 'Map', accent: 'from-lime-200/25 to-emerald-400/20', category: 'objects' },
    { id: 'mask', label: 'Mask', accent: 'from-fuchsia-400/25 to-violet-600/20', category: 'objects' },
    { id: 'banner', label: 'Banner', accent: 'from-indigo-400/25 to-purple-600/20', category: 'objects' },
  ],
  virtues: [
    { id: 'truth', label: 'Truth', accent: 'from-slate-200/25 to-blue-400/20', category: 'virtues' },
    { id: 'courage', label: 'Courage', accent: 'from-red-400/25 to-rose-500/20', category: 'virtues' },
    { id: 'integrity', label: 'Integrity', accent: 'from-sky-300/25 to-blue-500/20', category: 'virtues' },
    { id: 'patience', label: 'Patience', accent: 'from-emerald-300/25 to-teal-500/20', category: 'virtues' },
    { id: 'resolve', label: 'Resolve', accent: 'from-orange-400/25 to-amber-500/20', category: 'virtues' },
    { id: 'mercy', label: 'Mercy', accent: 'from-pink-300/25 to-rose-400/20', category: 'virtues' },
    { id: 'wit', label: 'Wit', accent: 'from-fuchsia-300/25 to-violet-500/20', category: 'virtues' },
    { id: 'temperance', label: 'Temperance', accent: 'from-zinc-300/25 to-stone-500/20', category: 'virtues' },
    { id: 'clarity', label: 'Clarity', accent: 'from-cyan-300/25 to-sky-500/20', category: 'virtues' },
    { id: 'discipline', label: 'Discipline', accent: 'from-slate-500/25 to-zinc-700/20', category: 'virtues' },
    { id: 'grace', label: 'Grace', accent: 'from-rose-200/25 to-pink-400/20', category: 'virtues' },
    { id: 'focus', label: 'Focus', accent: 'from-indigo-300/25 to-blue-500/20', category: 'virtues' },
    { id: 'humility', label: 'Humility', accent: 'from-stone-300/25 to-zinc-500/20', category: 'virtues' },
    { id: 'fortitude', label: 'Fortitude', accent: 'from-orange-500/25 to-red-500/20', category: 'virtues' },
    { id: 'prudence', label: 'Prudence', accent: 'from-slate-300/25 to-sky-500/20', category: 'virtues' },
    { id: 'curiosity', label: 'Curiosity', accent: 'from-emerald-300/25 to-lime-500/20', category: 'virtues' },
    { id: 'balance', label: 'Balance', accent: 'from-zinc-200/25 to-cyan-400/20', category: 'virtues' },
    { id: 'loyalty', label: 'Loyalty', accent: 'from-blue-400/25 to-indigo-600/20', category: 'virtues' },
    { id: 'insight', label: 'Insight', accent: 'from-violet-300/25 to-fuchsia-500/20', category: 'virtues' },
    { id: 'steadiness', label: 'Steadiness', accent: 'from-stone-400/25 to-slate-600/20', category: 'virtues' },
    { id: 'care', label: 'Care', accent: 'from-rose-300/25 to-orange-400/20', category: 'virtues' },
    { id: 'honor', label: 'Honor', accent: 'from-amber-300/25 to-yellow-500/20', category: 'virtues' },
    { id: 'tact', label: 'Tact', accent: 'from-teal-300/25 to-cyan-500/20', category: 'virtues' },
    { id: 'candor', label: 'Candor', accent: 'from-slate-200/25 to-zinc-400/20', category: 'virtues' },
  ],
  colors: [
    { id: 'red', label: 'Red', accent: 'from-red-500/25 to-rose-600/20', category: 'colors' },
    { id: 'blue', label: 'Blue', accent: 'from-sky-400/25 to-blue-600/20', category: 'colors' },
    { id: 'gold', label: 'Gold', accent: 'from-yellow-300/25 to-amber-500/20', category: 'colors' },
    { id: 'green', label: 'Green', accent: 'from-emerald-400/25 to-green-600/20', category: 'colors' },
    { id: 'silver', label: 'Silver', accent: 'from-slate-200/25 to-zinc-500/20', category: 'colors' },
    { id: 'black', label: 'Black', accent: 'from-slate-600/25 to-zinc-900/20', category: 'colors' },
    { id: 'white', label: 'White', accent: 'from-stone-100/30 to-slate-300/20', category: 'colors' },
    { id: 'amber', label: 'Amber', accent: 'from-amber-300/25 to-orange-500/20', category: 'colors' },
    { id: 'violet', label: 'Violet', accent: 'from-fuchsia-400/25 to-purple-600/20', category: 'colors' },
    { id: 'crimson', label: 'Crimson', accent: 'from-red-500/25 to-rose-600/20', category: 'colors' },
    { id: 'azure', label: 'Azure', accent: 'from-sky-400/25 to-blue-600/20', category: 'colors' },
    { id: 'jade', label: 'Jade', accent: 'from-emerald-400/25 to-green-600/20', category: 'colors' },
    { id: 'cobalt', label: 'Cobalt', accent: 'from-blue-500/25 to-indigo-600/20', category: 'colors' },
    { id: 'ivory', label: 'Ivory', accent: 'from-stone-100/30 to-zinc-300/20', category: 'colors' },
    { id: 'ash', label: 'Ash', accent: 'from-zinc-400/25 to-slate-600/20', category: 'colors' },
    { id: 'coral', label: 'Coral', accent: 'from-rose-300/25 to-orange-400/20', category: 'colors' },
    { id: 'teal', label: 'Teal', accent: 'from-teal-400/25 to-cyan-600/20', category: 'colors' },
    { id: 'rose', label: 'Rose', accent: 'from-pink-300/25 to-rose-500/20', category: 'colors' },
  ],
};

const WEEKDAY_FLAVORS: Partial<Record<number, string>> = {
  1: 'Monday motivation hums beneath the glass.',
  3: 'Midweek static turns into signal if you listen for it.',
  5: 'Fri-Yay glimmer softens the omen, not the lesson.',
};

const TYPE_CONTENT: Record<string, { headlines: string[]; omens: string[]; watchFors: string[]; rituals: string[] }> = {
  watchfor: {
    headlines: [
      'A warning slips out ahead of the noise.',
      'The crystal points toward a threat worth checking twice.',
      'A quiet risk has become impatient.',
      'A subtle pattern is asking for a second pass.',
      'The next useful clue will arrive dressed as routine.',
      'A low-signal artifact is about to become important.',
      'The easy answer will look polished and still be wrong.',
      'A recurring thread is finally ready to be nINTELed.',
    ],
    omens: [
      'A neat explanation will arrive before the truthful one. Let the artifact have the last word.',
      'A familiar indicator will return wearing a slightly different costume. Look twice before dismissing it.',
      'The clue that feels too small for the slide deck will matter most by sunset.',
      'A harmless-seeming detail will keep surviving each retelling because it still has work to do.',
      'The thing that feels like background noise is hiding the day\'s real signal.',
      'A trusted label will mask something that deserves fresh skepticism.',
      'One pivot will seem too ordinary to chase until it opens the entire room.',
      'A small mismatch between source and story will reveal who is bluffing.',
    ],
    watchFors: [
      'Watch for infrastructure that looks routine because it has been reused too often.',
      'Watch for one stale detail that keeps surviving every retelling.',
      'Watch for a screenshot or hostname that improves when revisited with fresh eyes.',
      'Watch for a domain, file name, or alias that appears in more than one context for no good reason.',
      'Watch for evidence that arrives already summarized before you have seen the raw shape of it.',
      'Watch for a timestamp that quietly disagrees with the story built around it.',
      'Watch for an IOC that feels decorative until it is compared side by side.',
      'Watch for the item everyone assumes has already been validated.',
    ],
    rituals: [
      'Ritual advice: capture the evidence while it is still ordinary enough to be trusted.',
      'Ritual advice: write down the boring pivot first, then chase the glamorous one.',
      'Ritual advice: let the timeline carry the argument until the facts are stronger than the vibes.',
      'Ritual advice: preserve the first weird artifact before the cleaner narrative can sand it down.',
      'Ritual advice: trust the breadcrumb that keeps showing up in inconvenient places.',
      'Ritual advice: compare one known-good sample before declaring the unknown malicious.',
      'Ritual advice: pause before briefing and ask what would falsify your favorite story.',
      'Ritual advice: revisit one dismissed lead after the rest of the puzzle gets louder.',
    ],
  },
  posture: {
    headlines: [
      'Your footing matters more than your flair today.',
      'The crystal has notes about your analyst posture.',
      'Today rewards a steadier hand than usual.',
      'Your restraint will do more than your speed today.',
      'A calm posture will outperform a dramatic one.',
      'The right tempo today is deliberate, not timid.',
      'Precision will feel slower than it is.',
      'The room needs steadiness more than certainty.',
    ],
    omens: [
      'Someone else will mistake confidence for evidence. You do not have to join them.',
      'The quiet lead will age better than the dramatic one. Preserve it before someone talks over it.',
      'A tidy summary will tempt you to stop early. Resist it once.',
      'You will be invited to sound more certain than the evidence deserves. Decline gracefully.',
      'A useful answer will appear only after you stop trying to make it elegant.',
      'The best move today may look unglamorous from across the room.',
      'A conversation will improve the moment you replace certainty with one precise question.',
      'An unfinished note will be more honest than a polished overreach.',
    ],
    watchFors: [
      'Watch for notes that sound finished before the timeline is actually complete.',
      'Watch for your favorite theory becoming too convenient to challenge.',
      'Watch for the moment when patience becomes the sharpest tool in the room.',
      'Watch for a handoff point where haste would quietly mutate the meaning.',
      'Watch for the urge to fill silence with more confidence than you actually have.',
      'Watch for the briefing line that sounds clean because it left out the caveat.',
      'Watch for the moment when slowing down becomes the only way to stay accurate.',
      'Watch for emotional certainty hiding inside professional language.',
    ],
    rituals: [
      'Ritual advice: ask one precise follow-up before the room gets attached to the wrong story.',
      'Ritual advice: if the pattern flatters your instincts, challenge it once before you brief it.',
      'Ritual advice: keep one eyebrow raised until the evidence gets less theatrical.',
      'Ritual advice: write the caveat while the evidence is still warm.',
      'Ritual advice: let the facts stay slightly awkward instead of forcing them into a cleaner shape.',
      'Ritual advice: save one sentence in your briefing for what you do not know yet.',
      'Ritual advice: choose the question that reduces risk, not the one that sounds smartest.',
      'Ritual advice: make room for the analyst who nINTELes the detail nobody else wanted.',
    ],
  },
  weirdness: {
    headlines: [
      'The strange detail would like your attention.',
      'The crystal has found the odd corner of today.',
      'A hidden absurdity is trying to become useful.',
      'An outlier is waiting to stop being decorative.',
      'Today\'s weirdness has structure if you stay with it.',
      'The odd clue is not here by accident.',
      'Something off-pattern is about to become legible.',
      'A crooked detail is pointing in a straight line.',
    ],
    omens: [
      'A tiny inconsistency will reveal more than the loudest claim in the room.',
      'The least glamorous host in the cluster is hiding the best story.',
      'A coincidence will keep repeating until someone nINTELes it is not one.',
      'The funniest artifact on the page will end up being the most sincere.',
      'Something that looks mislabeled may actually be the label that finally tells the truth.',
      'The wrong-looking sample will explain the rest of the set.',
      'A pattern will first appear as a nuisance, then as the answer.',
      'The clue you nearly skip for being awkward will carry the day.',
    ],
    watchFors: [
      'Watch for the pivot you nearly skipped because it seemed too boring to matter.',
      'Watch for something mislabeled that has been trusted for too long.',
      'Watch for the clue that only becomes suspicious when compared side by side.',
      'Watch for one data point that keeps refusing to match its neighbors.',
      'Watch for an odd filename, favicon, banner, or caption that feels too specific to be random.',
      'Watch for a relationship that only makes sense once you stop assuming the labels are correct.',
      'Watch for a supposedly isolated clue that becomes useful when paired with an older note.',
      'Watch for the artifact that feels like a joke until it repeats.',
    ],
    rituals: [
      'Ritual advice: follow the weird breadcrumb one step farther than feels socially acceptable.',
      'Ritual advice: compare the mundane artifact to the dramatic claim and trust the mismatch.',
      'Ritual advice: linger on the oddity just long enough to learn whether it is a joke or a pattern.',
      'Ritual advice: open one more tab for the artifact you cannot quite justify yet.',
      'Ritual advice: keep a scratchpad for the details that do not fit; one of them will mature.',
      'Ritual advice: preserve the odd sample before anyone normalizes it.',
      'Ritual advice: let the strange clue stay strange until it explains itself.',
      'Ritual advice: if the anomaly repeats twice, promote it from curiosity to lead.',
    ],
  },
};

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickBySeed<T>(items: T[], seed: string): T {
  return items[hashSeed(seed) % items.length];
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  let state = hashSeed(seed) || 1;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseCycleKey(cycleKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = cycleKey.split('-').map(Number);
  return { year, month, day };
}

function getCycleOrdinal(cycleKey: string): number {
  const { year, month, day } = parseCycleKey(cycleKey);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function getCycleKeyFromOrdinal(ordinal: number): string {
  const date = new Date(ordinal * 86_400_000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCategoryMeta(categoryId: FortuneIntChoiceCategory): FortuneIntChoiceCategoryMeta {
  return FORTUNE_INT_CATEGORIES.find((category) => category.id === categoryId) ?? FORTUNE_INT_CATEGORIES[0];
}

function getWeekdayFlavor(cycleKey: string): string | undefined {
  const { year, month, day } = parseCycleKey(cycleKey);
  return WEEKDAY_FLAVORS[new Date(year, month - 1, day).getDay()];
}

function getRepeatWindowSize(pool: FortuneIntChoice[]): number {
  const fullWindow = pool.length - (pool.length % DAILY_CHOICE_COUNT);
  return Math.max(DAILY_CHOICE_COUNT, fullWindow || pool.length);
}

function getFortuneIntChoiceCategoryByOrdinal(cycleOrdinal: number): FortuneIntChoiceCategoryMeta {
  const blockIndex = Math.floor(cycleOrdinal / DAILY_CHOICE_COUNT);
  const blockOffset = cycleOrdinal % DAILY_CHOICE_COUNT;
  const categoryOrder = seededShuffle(FORTUNE_INT_CATEGORIES, `category-block:${blockIndex}`);
  return categoryOrder[blockOffset];
}

export function getFortuneIntChoiceCategory(now = new Date()): FortuneIntChoiceCategoryMeta {
  const cycleKey = getFortuneIntCycleKey(now);
  const cycleOrdinal = getCycleOrdinal(cycleKey);
  return getFortuneIntChoiceCategoryByOrdinal(cycleOrdinal);
}

export function isFortuneIntCommand(text: string): boolean {
  return /^\/fortuneint\b/i.test(text.trim());
}

export function getFortuneIntCycleKey(now = new Date()): string {
  const cycle = new Date(now);
  if (cycle.getHours() < RESET_HOUR) {
    cycle.setDate(cycle.getDate() - 1);
  }
  const year = cycle.getFullYear();
  const month = String(cycle.getMonth() + 1).padStart(2, '0');
  const day = String(cycle.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFortuneIntNextReset(now = new Date()): number {
  const nextReset = new Date(now);
  nextReset.setHours(RESET_HOUR, 0, 0, 0);
  if (now.getTime() >= nextReset.getTime()) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  return nextReset.getTime();
}

export function getFortuneIntDailyChoices(now = new Date()): FortuneIntChoice[] {
  const cycleKey = getFortuneIntCycleKey(now);
  const cycleOrdinal = getCycleOrdinal(cycleKey);
  const category = getFortuneIntChoiceCategory(now);
  const pool = CHOICE_POOLS[category.id];
  const repeatWindowSize = getRepeatWindowSize(pool);
  const recentChoiceIds: string[] = [];
  let todaysChoices = pool.slice(0, DAILY_CHOICE_COUNT);

  for (let day = 0; day <= cycleOrdinal; day += 1) {
    if (getFortuneIntChoiceCategoryByOrdinal(day).id !== category.id) {
      continue;
    }

    const dayCycleKey = getCycleKeyFromOrdinal(day);
    const freshChoices = seededShuffle(
      pool.filter((choice) => !recentChoiceIds.includes(choice.id)),
      `choices:${category.id}:fresh:${dayCycleKey}`,
    );
    const repeatChoices = seededShuffle(
      pool.filter((choice) => recentChoiceIds.includes(choice.id)),
      `choices:${category.id}:repeat:${dayCycleKey}`,
    );

    todaysChoices = [...freshChoices, ...repeatChoices].slice(0, DAILY_CHOICE_COUNT);
    recentChoiceIds.push(...todaysChoices.map((choice) => choice.id));
    if (recentChoiceIds.length > repeatWindowSize) {
      recentChoiceIds.splice(0, recentChoiceIds.length - repeatWindowSize);
    }
  }

  return todaysChoices;
}

export function buildFortuneIntIntro(now = new Date()): {
  invocation: string;
  subtitle: string;
  cycleKey: string;
  category: FortuneIntChoiceCategoryMeta;
  weekdayFlavor?: string;
} {
  const cycleKey = getFortuneIntCycleKey(now);
  const category = getFortuneIntChoiceCategory(now);
  const weekdayFlavor = getWeekdayFlavor(cycleKey);
  const subtitle = `${pickBySeed(SUBTITLES, `subtitle:${cycleKey}`)} ${category.introLabel}${weekdayFlavor ? ` ${weekdayFlavor}` : ''}`;
  return {
    cycleKey,
    invocation: pickBySeed(INVOCATIONS, `invocation:${cycleKey}`),
    subtitle,
    category,
    weekdayFlavor,
  };
}

export function buildFortuneIntReading(typeId: string, choiceId: string, folderName?: string, now = new Date()): FortuneIntReading {
  const cycleKey = getFortuneIntCycleKey(now);
  const choices = getFortuneIntDailyChoices(now);
  const choice = choices.find((item) => item.id === choiceId) ?? choices[0];
  const type = FORTUNE_INT_TYPES.find((item) => item.id === typeId) ?? FORTUNE_INT_TYPES[0];
  const typeContent = TYPE_CONTENT[type.id] ?? TYPE_CONTENT.watchfor;
  const category = getCategoryMeta(choice.category);
  const choiceSeed = `${cycleKey}:${type.id}:${category.id}:${choice.id}:${folderName ?? 'global'}`;
  const intro = buildFortuneIntIntro(now);
  const closing = intro.weekdayFlavor
    ? `The crystal closes after one reading. Return after 6:00 AM for another glimpse. ${intro.weekdayFlavor}`
    : 'The crystal closes after one reading. Return after 6:00 AM for another glimpse.';

  return {
    cycleKey,
    typeId: type.id,
    typeLabel: type.label,
    categoryId: category.id,
    categoryLabel: category.label,
    categoryPrompt: category.promptLabel,
    choiceId: choice.id,
    choiceLabel: choice.label,
    invocation: intro.invocation,
    subtitle: intro.subtitle,
    weekdayFlavor: intro.weekdayFlavor,
    headline: pickBySeed(typeContent.headlines, `headline:${choiceSeed}`),
    omen: pickBySeed(typeContent.omens, `omen:${choiceSeed}`),
    watchFor: pickBySeed(typeContent.watchFors, `watch:${choiceSeed}`),
    ritual: pickBySeed(typeContent.rituals, `ritual:${choiceSeed}`),
    closing,
    investigationFlavor: folderName,
    generatedAt: now.getTime(),
    nextResetAt: getFortuneIntNextReset(now),
  };
}
