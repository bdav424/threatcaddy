import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JournalPage } from '../types';

// Excalidraw needs a real canvas/layout engine that jsdom doesn't provide, so
// it's stubbed here — these tests exercise JournalCanvas's own logic (Phase 2
// entity-bridge selection tracking, the imperative insertLabel handle) against
// a fake Excalidraw that exposes just enough surface (excalidrawAPI callback,
// onChange) to drive it, not Excalidraw's real rendering.
const { updateSceneSpy } = vi.hoisted(() => ({ updateSceneSpy: vi.fn() }));

vi.mock('@excalidraw/excalidraw', () => {
  function Excalidraw(props: Record<string, unknown>) {
    const api = {
      getAppState: () => ({ scrollX: 0, scrollY: 0, zoom: { value: 1 }, width: 800, height: 600 }),
      getSceneElements: () => [],
      updateScene: updateSceneSpy,
    };
    (props.excalidrawAPI as (a: typeof api) => void)?.(api);
    const onChange = props.onChange as ((els: unknown[], appState: unknown) => void) | undefined;
    return (
      <div data-testid="mock-excalidraw">
        <button
          type="button"
          data-testid="simulate-select-text"
          onClick={() => onChange?.(
            [{ id: 'el1', type: 'text', text: 'hello world', originalText: 'hello world' }],
            { selectedElementIds: { el1: true } },
          )}
        >
          select
        </button>
        <button
          type="button"
          data-testid="simulate-deselect"
          onClick={() => onChange?.([], { selectedElementIds: {} })}
        >
          deselect
        </button>
      </div>
    );
  }
  const MainMenuStub = ({ children }: { children?: unknown }) => <div>{children as never}</div>;
  MainMenuStub.DefaultItems = {
    ClearCanvas: () => null,
    ChangeCanvasBackground: () => null,
    ToggleTheme: () => null,
    Help: () => null,
  };
  MainMenuStub.Separator = () => null;
  return {
    Excalidraw,
    MainMenu: MainMenuStub,
    convertToExcalidrawElements: (skeleton: Array<Record<string, unknown>>) =>
      skeleton.map((s, i) => ({ ...s, id: s.id ?? `gen-${i}` })),
  };
});

const { default: JournalCanvas } = await import('../components/Journal/JournalCanvas');
type JournalCanvasHandle = import('../components/Journal/JournalCanvas').JournalCanvasHandle;

const basePage: JournalPage = {
  id: 'p1',
  title: 'Untitled',
  content: '',
  theme: 'plain',
  createdAt: 0,
  updatedAt: 0,
};

describe('JournalCanvas entity bridge (Phase 2)', () => {
  it('disables Promote until a single text element is selected, then reports its text', async () => {
    const onPromote = vi.fn();
    const user = userEvent.setup();
    render(<JournalCanvas page={basePage} onUpdate={() => {}} onPromote={onPromote} />);

    const promoteBtn = screen.getByRole('button', { name: /promote/i });
    expect(promoteBtn).toBeDisabled();

    await user.click(screen.getByTestId('simulate-select-text'));
    expect(promoteBtn).not.toBeDisabled();

    await user.click(promoteBtn);
    expect(onPromote).toHaveBeenCalledWith('hello world');
  });

  it('re-disables Promote once the selection is cleared', async () => {
    const user = userEvent.setup();
    render(<JournalCanvas page={basePage} onUpdate={() => {}} onPromote={() => {}} />);

    await user.click(screen.getByTestId('simulate-select-text'));
    expect(screen.getByRole('button', { name: /promote/i })).not.toBeDisabled();

    await user.click(screen.getByTestId('simulate-deselect'));
    expect(screen.getByRole('button', { name: /promote/i })).toBeDisabled();
  });

  it('omits the Promote/Add entity toolbar entirely when neither callback is provided', () => {
    render(<JournalCanvas page={basePage} onUpdate={() => {}} />);
    expect(screen.queryByRole('button', { name: /promote/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add entity/i })).not.toBeInTheDocument();
  });

  it('calls onAddEntity when the Add entity button is clicked', async () => {
    const onAddEntity = vi.fn();
    const user = userEvent.setup();
    render(<JournalCanvas page={basePage} onUpdate={() => {}} onAddEntity={onAddEntity} />);

    await user.click(screen.getByRole('button', { name: /add entity/i }));
    expect(onAddEntity).toHaveBeenCalledTimes(1);
  });

  it('insertLabel (imperative handle) pushes a text element into the scene via updateScene', () => {
    updateSceneSpy.mockClear();
    const ref = createRef<JournalCanvasHandle>();
    render(<JournalCanvas ref={ref} page={basePage} onUpdate={() => {}} />);

    act(() => { ref.current?.insertLabel('[Note] Example'); });

    expect(updateSceneSpy).toHaveBeenCalledTimes(1);
    const call = updateSceneSpy.mock.calls[0][0] as { elements: Array<{ type: string; text: string }> };
    expect(call.elements).toHaveLength(1);
    expect(call.elements[0]).toMatchObject({ type: 'text', text: '[Note] Example' });
  });
});
