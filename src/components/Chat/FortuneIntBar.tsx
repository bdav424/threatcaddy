import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { FortuneIntIcon } from '../Common/FortuneIntIcon';
import {
  buildFortuneIntIntro,
  buildFortuneIntReading,
  FORTUNE_INT_TYPES,
  getFortuneIntCycleKey,
  getFortuneIntDailyChoices,
  getFortuneIntNextReset,
  type FortuneIntStoredReading,
} from '../../lib/fortuneint';
import { cn } from '../../lib/utils';

interface FortuneIntBarProps {
  folderName?: string;
  openRequest?: number;
  fullScreen?: boolean;
}

const STORAGE_KEY = 'threatcaddy-fortuneint-reading-v4';
const TOKEN_FIZZLE_MS = 420;

function readStoredReading(now = new Date()): FortuneIntStoredReading | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FortuneIntStoredReading;
    return parsed.cycleKey === getFortuneIntCycleKey(now) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredReading(value: FortuneIntStoredReading | null): void {
  if (typeof localStorage === 'undefined') return;
  if (!value) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function formatResetTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function FortuneIntBar({ folderName, openRequest, fullScreen = false }: FortuneIntBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState(FORTUNE_INT_TYPES[0].id);
  const [storedReading, setStoredReading] = useState<FortuneIntStoredReading | null>(() => readStoredReading());
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [choicesReady, setChoicesReady] = useState(false);
  const [readingVisible, setReadingVisible] = useState(() => !!readStoredReading());
  const choiceTimeoutRef = useRef<number | null>(null);
  const readingRevealRef = useRef<number | null>(null);

  useEffect(() => {
    if (!openRequest) return;
    setExpanded(true);
  }, [openRequest]);

  useEffect(() => {
    if (fullScreen) setExpanded(true);
  }, [fullScreen]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const current = readStoredReading(new Date(nowTick));
    setStoredReading(current);
    if (!current) {
      writeStoredReading(null);
    }
  }, [nowTick]);

  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const intro = useMemo(() => buildFortuneIntIntro(now), [now]);
  const choices = useMemo(() => getFortuneIntDailyChoices(now), [now]);
  const nextResetAt = storedReading?.reading.nextResetAt ?? getFortuneIntNextReset(now);
  const locked = storedReading?.cycleKey === intro.cycleKey;
  const categoryLabel = storedReading?.reading.categoryLabel ?? intro.category.label;
  const categoryPrompt = storedReading?.reading.categoryPrompt ?? intro.category.promptLabel;
  const categoryHeading = `The table is set with ${categoryLabel.toLowerCase()} today.`;
  const categoryDescription = `Three ${categoryLabel.toLowerCase()} share the same omen. Choose the one that answers back.`;
  const weekdayFlavor = storedReading?.reading.weekdayFlavor ?? intro.weekdayFlavor;
  const selectedChoiceAccent = useMemo(
    () => choices.find((choice) => choice.id === storedReading?.choiceId)?.accent,
    [choices, storedReading?.choiceId],
  );

  useEffect(() => () => {
    if (choiceTimeoutRef.current !== null) {
      window.clearTimeout(choiceTimeoutRef.current);
    }
    if (readingRevealRef.current !== null) {
      window.clearTimeout(readingRevealRef.current);
    }
  }, []);

  useEffect(() => {
    if (!expanded || locked || pendingChoiceId) {
      setChoicesReady(false);
      return;
    }

    setChoicesReady(false);
    const revealTimer = window.setTimeout(() => setChoicesReady(true), 50);
    return () => window.clearTimeout(revealTimer);
  }, [expanded, locked, pendingChoiceId, nowTick]);

  useEffect(() => {
    if (readingRevealRef.current !== null) {
      window.clearTimeout(readingRevealRef.current);
      readingRevealRef.current = null;
    }

    if (!storedReading) {
      setReadingVisible(false);
      return;
    }

    setReadingVisible(false);
    readingRevealRef.current = window.setTimeout(() => {
      setReadingVisible(true);
      readingRevealRef.current = null;
    }, 90);
  }, [storedReading]);

  const handleChoose = useCallback((choiceId: string) => {
    if (pendingChoiceId || locked) return;
    if (choiceTimeoutRef.current !== null) {
      window.clearTimeout(choiceTimeoutRef.current);
    }
    setPendingChoiceId(choiceId);
    setChoicesReady(false);
    setReadingVisible(false);
    const reading = buildFortuneIntReading(selectedTypeId, choiceId, folderName, new Date());
    choiceTimeoutRef.current = window.setTimeout(() => {
      const nextValue: FortuneIntStoredReading = {
        cycleKey: reading.cycleKey,
        choiceId: reading.choiceId,
        reading,
        selectedAt: Date.now(),
      };
      writeStoredReading(nextValue);
      setStoredReading(nextValue);
      setPendingChoiceId(null);
      setExpanded(true);
      choiceTimeoutRef.current = null;
    }, TOKEN_FIZZLE_MS);
  }, [folderName, locked, pendingChoiceId, selectedTypeId]);

  return (
    <div className={cn(
      'border-purple/15 bg-gradient-to-r from-purple/8 via-bg-deep to-sky-500/8',
      fullScreen ? 'flex flex-1 min-h-0 flex-col' : 'border-b shrink-0',
    )}>
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple/20 bg-bg-raised/80 text-purple shadow-[0_0_16px_rgba(144,97,249,0.14)]">
          <FortuneIntIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-purple/80">FortuneINT</span>
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                <Lock size={10} />
                Daily reading sealed
              </span>
            )}
          </div>
          <p className="truncate text-[13px] text-text-primary">
            {storedReading?.reading.invocation ?? intro.invocation}
          </p>
          <p className="text-[11px] text-text-muted">
            {locked
              ? `The crystal stirs again at ${formatResetTime(nextResetAt)}.`
              : `One reading per day. Reset at ${formatResetTime(nextResetAt)}.`}
          </p>
        </div>
        {!fullScreen && (
          <button
            onClick={() => setExpanded((value) => !value)}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-raised/70 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            {expanded ? (
              <span className="inline-flex items-center gap-1"><ChevronUp size={12} /> Hide</span>
            ) : (
              <span className="inline-flex items-center gap-1"><ChevronDown size={12} /> Reveal</span>
            )}
          </button>
        )}
      </div>

      {expanded && (
        <div className={cn(fullScreen ? 'flex-1 min-h-0 px-4 pb-4' : 'px-4 pb-3')}>
          <div className={cn(
            'p-4',
            fullScreen
              ? 'flex h-full flex-col justify-center'
              : 'rounded-2xl border border-purple/20 bg-black/10 backdrop-blur-sm',
          )}>
            <div className={cn(
              fullScreen ? 'mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center text-center' : '',
            )}>
              <div className={cn(fullScreen ? 'mx-auto max-w-3xl' : '')}>
                <p className={cn(
                  'text-text-primary italic transition-all duration-500',
                  fullScreen
                    ? 'text-xl font-medium leading-relaxed text-balance sm:text-[1.9rem]'
                    : 'text-sm',
                )}>
                  "{storedReading?.reading.invocation ?? intro.invocation}"
                </p>
                <p className={cn(
                  'mt-1 text-text-muted',
                  fullScreen ? 'text-sm leading-6 sm:text-[15px]' : 'text-xs',
                )}>
                  {storedReading?.reading.subtitle ?? intro.subtitle}
                </p>
              </div>

              {!locked && (
                <>
                  <div className={cn(
                    'mt-4 rounded-2xl border border-purple/20 bg-bg-deep/45 px-4 py-4 text-center backdrop-blur-sm transition-all duration-500',
                    fullScreen ? 'mx-auto w-full max-w-2xl' : '',
                  )}>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-purple/25 bg-purple/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-purple/80">
                        Today&apos;s table: {categoryLabel}
                      </span>
                      {weekdayFlavor && (
                        <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] text-sky-200/85">
                          {weekdayFlavor}
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'mt-3 font-medium text-text-primary',
                      fullScreen ? 'text-xl sm:text-[1.65rem]' : 'text-sm',
                    )}>
                      {categoryHeading}
                    </p>
                    <p className={cn(
                      'mt-2 text-text-secondary',
                      fullScreen ? 'text-sm leading-6 sm:text-[15px]' : 'text-xs',
                    )}>
                      {categoryDescription}
                    </p>
                  </div>
                  <div className={cn('mt-3', fullScreen && 'mx-auto w-full max-w-xl')}>
                    <label className={cn(
                      'mb-1 block uppercase tracking-[0.16em] text-text-muted',
                      fullScreen ? 'text-[11px]' : 'text-[10px]',
                    )}>
                      Reading lens
                    </label>
                    <select
                      value={selectedTypeId}
                      onChange={(event) => setSelectedTypeId(event.target.value)}
                      disabled={pendingChoiceId !== null}
                      className={cn(
                        'rounded-xl border border-border-subtle bg-bg-deep px-3 py-2 text-text-primary focus:outline-none focus:border-purple disabled:cursor-wait disabled:opacity-60',
                        fullScreen ? 'w-full text-center text-base' : 'w-full text-sm sm:w-[280px]',
                      )}
                    >
                      {FORTUNE_INT_TYPES.map((type) => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                    <p className={cn(
                      'mt-2 text-text-muted',
                      fullScreen ? 'text-xs' : 'text-[11px]',
                    )}>
                      The category stays fixed for the day. This sets how the crystal interprets your choice.
                    </p>
                  </div>
                  <div className={cn(
                    'mt-3 grid gap-2',
                    fullScreen ? 'mx-auto w-full max-w-4xl sm:grid-cols-3' : 'sm:grid-cols-3',
                  )}>
                    {choices.map((choice, index) => {
                      const selected = pendingChoiceId === choice.id;
                      const exiting = pendingChoiceId !== null;
                      return (
                        <button
                          key={choice.id}
                          onClick={() => handleChoose(choice.id)}
                          disabled={pendingChoiceId !== null}
                          style={{ transitionDelay: exiting ? `${index * 45}ms` : `${index * 75}ms` }}
                          className={cn(
                            'group relative overflow-hidden rounded-xl border border-border-subtle bg-gradient-to-br px-3 py-3 text-left transition-[opacity,transform,filter,border-color,box-shadow] duration-500 ease-out hover:border-purple/30 hover:-translate-y-0.5 disabled:pointer-events-none',
                            choice.accent,
                            !exiting && choicesReady
                              ? 'translate-y-0 scale-100 opacity-100 blur-0'
                              : 'translate-y-3 scale-[0.98] opacity-0 blur-[1.5px]',
                            exiting && !selected && 'translate-y-2 scale-95 opacity-0 blur-sm',
                            selected && 'border-purple/35 shadow-[0_0_24px_rgba(144,97,249,0.16)]',
                            exiting && selected && '-translate-y-1 rotate-[1.5deg] scale-95 opacity-0 blur-sm',
                            fullScreen && 'min-h-[132px] text-center',
                          )}
                        >
                          <div className="absolute inset-x-5 top-2 h-px bg-white/15" />
                          <div className={cn(
                            'text-[10px] uppercase tracking-[0.16em] text-text-muted',
                            fullScreen && 'text-[11px]',
                          )}>
                            {selected ? `${categoryPrompt} accepted` : categoryPrompt}
                          </div>
                          <div className={cn(
                            'mt-2 font-medium text-text-primary',
                            fullScreen ? 'text-lg' : 'text-sm',
                          )}>
                            {choice.label}
                          </div>
                          <div className="mt-2 text-[11px] italic text-purple/80">
                            {selected ? 'The sparks scatter into signal...' : 'Let the omen answer back.'}
                          </div>
                          <div className={cn(
                            'pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/10 opacity-0 transition-opacity duration-300',
                            selected && 'opacity-100',
                          )} />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {storedReading && !pendingChoiceId && (
                <div className={cn(
                  'mt-3 transition-all duration-500',
                  readingVisible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-3 opacity-0 blur-sm',
                  fullScreen && 'mx-auto w-full max-w-4xl text-center',
                )}>
                  <div className={cn(
                    'gap-2',
                    fullScreen
                      ? 'flex flex-col items-center justify-center text-center sm:flex-row sm:flex-wrap'
                      : 'flex items-center justify-between',
                  )}>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Reading lens</div>
                      <div className="text-sm font-medium text-text-primary">{storedReading.reading.typeLabel}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-purple/70">
                        {storedReading.reading.categoryLabel}
                      </div>
                      <div className="text-sm font-medium text-text-primary">{storedReading.reading.choiceLabel}</div>
                    </div>
                    <div className={cn(
                      'text-[11px] text-text-muted',
                      fullScreen ? '' : 'text-right',
                    )}>
                      Sealed until {formatResetTime(storedReading.reading.nextResetAt)}
                    </div>
                  </div>
                  <div className={cn(
                    'relative mt-3 overflow-hidden rounded-2xl border p-4 space-y-2',
                    selectedChoiceAccent
                      ? cn('border-white/10 bg-gradient-to-br', selectedChoiceAccent)
                      : 'border-purple/15 bg-bg-deep/60',
                    fullScreen && 'mx-auto max-w-3xl p-6',
                  )}>
                    {selectedChoiceAccent && (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-black/55 to-black/75" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_70%)]" />
                      </>
                    )}
                    <p className={cn(
                      'relative font-medium text-text-primary',
                      fullScreen ? 'text-xl sm:text-2xl' : 'text-sm',
                    )}>
                      {storedReading.reading.headline}
                    </p>
                    {storedReading.reading.investigationFlavor && (
                      <p className={cn(
                        'relative text-purple/80',
                        fullScreen ? 'text-sm' : 'text-xs',
                      )}>
                        Investigation flavor: {storedReading.reading.investigationFlavor}
                      </p>
                    )}
                    <p className={cn(
                      'relative text-text-secondary',
                      fullScreen ? 'text-base leading-7' : 'text-sm',
                    )}>
                      {storedReading.reading.omen}
                    </p>
                    <p className={cn(
                      'relative text-text-muted',
                      fullScreen ? 'text-sm leading-6' : 'text-xs',
                    )}>
                      {storedReading.reading.watchFor}
                    </p>
                    <p className={cn(
                      'relative text-sky-200/85',
                      fullScreen ? 'text-sm leading-6' : 'text-xs',
                    )}>
                      {storedReading.reading.ritual}
                    </p>
                    <p className="relative text-[11px] text-text-muted">{storedReading.reading.closing}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
