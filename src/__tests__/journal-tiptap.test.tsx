import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JournalView } from '../components/Journal/JournalView';
import { db } from '../db';

// jsdom has no layout engine, so Range/Element don't implement getClientRects
// or getBoundingClientRect (used by ProseMirror's scroll-into-view on every
// transaction), and document.elementFromPoint isn't implemented either (used
// on mousedown to resolve a click position to a doc position). Stub all three
// so typing/selecting/clicking don't throw mid-test — the coordinates
// themselves are meaningless in jsdom either way.
const zeroRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return this; } } as DOMRect;
for (const proto of [Range.prototype, Element.prototype]) {
  if (!proto.getClientRects) proto.getClientRects = () => [] as unknown as DOMRectList;
  if (!proto.getBoundingClientRect) proto.getBoundingClientRect = () => zeroRect;
}
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// The "+" button now opens a New page / New book chooser (Slice B) instead
// of creating a page directly — click through it every time a test needs a
// fresh page.
async function clickNewPage(user: ReturnType<typeof userEvent.setup>) {
  const addBtn = await screen.findByTitle('New page or book');
  await user.click(addBtn);
  const newPageItem = await screen.findByRole('menuitem', { name: 'New page' });
  await user.click(newPageItem);
}

// Once the Slice C book-filter dropdown is present, a book's name matches
// both its <option> and its list header — pick the header specifically.
function getBookHeader(name: string) {
  return screen.getAllByText(name).find((el) => el.tagName !== 'OPTION')!;
}

async function renderJournalWithNewPage() {
  const user = userEvent.setup();
  render(<JournalView folders={[]} onTearToInvestigation={async () => {}} />);
  await clickNewPage(user);
  const editor = await waitFor(() => {
    const el = document.querySelector<HTMLElement>('.ProseMirror');
    if (!el) throw new Error('editor not mounted');
    return el;
  });
  return { user, editor };
}

describe('Journal TipTap editor', () => {
  beforeEach(async () => {
    await db.journalPages.clear();
  });

  it('shows the placeholder decoration on a fresh empty page', async () => {
    const { editor } = await renderJournalWithNewPage();
    expect(editor.querySelector('.is-editor-empty')).toBeTruthy();
  });

  it('typing produces sanitizer-compatible markup and clears the placeholder', async () => {
    const { user, editor } = await renderJournalWithNewPage();
    await user.click(editor);
    await user.type(editor, 'Investigation notes');
    await waitFor(() => expect(editor.textContent).toContain('Investigation notes'));
    expect(editor.querySelector('.is-editor-empty')).toBeFalsy();
  });

  it('Bold/Underline toolbar buttons toggle active state and produce matching markup', async () => {
    const { user, editor } = await renderJournalWithNewPage();
    await user.click(editor);
    await user.type(editor, 'formatted text');
    await user.keyboard('{Control>}a{/Control}');

    const boldBtn = screen.getByTitle('Bold');
    const underlineBtn = screen.getByTitle('Underline');
    expect(boldBtn.className).not.toMatch(/text-accent/);

    await user.click(boldBtn);
    await waitFor(() => expect(boldBtn.className).toMatch(/text-accent/));
    await user.click(underlineBtn);
    await waitFor(() => expect(underlineBtn.className).toMatch(/text-accent/));

    expect(editor.innerHTML).toMatch(/<strong>/);
    expect(editor.innerHTML).toMatch(/<u>/);

    // toggling again turns it back off
    await user.click(boldBtn);
    await waitFor(() => expect(boldBtn.className).not.toMatch(/text-accent/));
  });

  it('H1 toolbar button toggles heading markup and active state', async () => {
    const { user, editor } = await renderJournalWithNewPage();
    await user.click(editor);
    await user.type(editor, 'A heading');

    const h1Btn = screen.getByTitle('Heading 1');
    await user.click(h1Btn);
    await waitFor(() => expect(editor.innerHTML).toMatch(/<h1/));
    await waitFor(() => expect(h1Btn.className).toMatch(/text-accent/));
  });

  it('applies a font to only the selected text, not the whole page', async () => {
    const { user, editor } = await renderJournalWithNewPage();
    await user.click(editor);
    await user.type(editor, 'AAAA BBBB CCCC');
    await waitFor(() => expect(editor.textContent).toBe('AAAA BBBB CCCC'));

    // jsdom doesn't support setSelectionRange on contenteditable (what
    // userEvent's Home/Arrow-key navigation relies on), so select "BBBB"
    // directly via the Selection/Range API instead, then let ProseMirror's
    // own selectionchange listener pick it up — same as a real mouse
    // double-click would, just without simulating the mouse.
    const textNode = editor.firstChild!.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 5);
    range.setEnd(textNode, 9);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    await waitFor(() => expect(window.getSelection()?.toString()).toBe('BBBB'));

    const fontSelect = screen.getByTitle('Font for selected text') as HTMLSelectElement;
    const monoOption = Array.from(fontSelect.options).find((o) => /mono/i.test(o.label));
    expect(monoOption).toBeTruthy();
    await user.selectOptions(fontSelect, monoOption!.value);

    await waitFor(() => {
      expect(editor.innerHTML).toMatch(/<span[^>]*style="[^"]*font-family[^"]*"[^>]*>BBBB<\/span>/);
    });
    // AAAA/CCCC must not have been swept into the font mark
    expect(editor.innerHTML).not.toMatch(/font-family[^>]*>[^<]*AAAA/);
    expect(editor.innerHTML).not.toMatch(/font-family[^>]*>[^<]*CCCC/);
  });

  it('regression: switching to a second page after editing the first does not crash', async () => {
    // Guards the bug where useEditor's [editor, page.id] effect deps read
    // editor.view.dom off an already-destroyed editor mid-transition (see
    // JournalView.tsx's guideMetrics effect comment). Reproduces by editing
    // page A, then creating page B in the same mounted PageEditor instance.
    const { user, editor } = await renderJournalWithNewPage();
    await user.click(editor);
    await user.type(editor, 'first page content');
    await waitFor(() => expect(editor.textContent).toContain('first page content'));

    await clickNewPage(user);

    await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.ProseMirror');
      expect(el?.querySelector('.is-editor-empty')).toBeTruthy();
    });
    // The failure boundary for the bug this guards renders "Something went
    // wrong" in place of the editor — assert it's absent.
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('persists content across a page switch and back', async () => {
    const { user, editor } = await renderJournalWithNewPage();
    await user.click(editor);
    await user.type(editor, 'remember me');
    await waitFor(() => expect(editor.textContent).toContain('remember me'));
    // wait out the 600ms save debounce
    await new Promise((r) => setTimeout(r, 700));
    await waitFor(async () => {
      const rows = await db.journalPages.toArray();
      expect(rows.some((r) => r.content.includes('remember me'))).toBe(true);
    });

    await clickNewPage(user);
    await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.ProseMirror');
      expect(el?.querySelector('.is-editor-empty')).toBeTruthy();
    });

    const firstPageEntry = screen.getAllByText('Untitled Page').map((n) => n.closest('button')!).find((b) => !b.className.includes('accent'));
    expect(firstPageEntry).toBeTruthy();
    await user.click(firstPageEntry!);

    await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.ProseMirror');
      expect(el?.textContent).toContain('remember me');
    });
  });
});

describe('Journal page list: right-click actions + TLP', () => {
  beforeEach(async () => {
    await db.journalPages.clear();
  });

  it('opens a context menu on right-click with Edit details / Tear / Delete', async () => {
    await renderJournalWithNewPage();
    const pageButton = screen.getByText('Untitled Page').closest('button')!;

    fireEvent.contextMenu(pageButton, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());

    expect(screen.getByRole('menuitem', { name: 'Edit details' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Tear to investigation' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('closes the context menu on Escape and on outside click', async () => {
    const { user } = await renderJournalWithNewPage();
    const pageButton = screen.getByText('Untitled Page').closest('button')!;

    fireEvent.contextMenu(pageButton, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    fireEvent.contextMenu(pageButton, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('deletes a page from the context menu', async () => {
    const { user } = await renderJournalWithNewPage();
    const pageButton = screen.getByText('Untitled Page').closest('button')!;

    fireEvent.contextMenu(pageButton, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    await waitFor(async () => {
      const rows = await db.journalPages.toArray();
      expect(rows).toHaveLength(0);
    });
  });

  it('Edit details sets TLP, persists it, and shows a chip + data-tlp on the page item', async () => {
    const { user } = await renderJournalWithNewPage();
    const pageButton = screen.getByText('Untitled Page').closest('button')!;
    expect(pageButton).not.toHaveAttribute('data-tlp');

    fireEvent.contextMenu(pageButton, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.click(screen.getByRole('menuitem', { name: 'Edit details' }));
    await waitFor(() => expect(screen.getByText('Page details')).toBeInTheDocument());

    const clsSelect = screen.getByLabelText('Classification level') as HTMLSelectElement;
    await user.selectOptions(clsSelect, 'TLP:AMBER');

    await waitFor(async () => {
      const rows = await db.journalPages.toArray();
      expect(rows[0]?.clsLevel).toBe('TLP:AMBER');
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('Page details')).toBeNull());

    await waitFor(() => expect(screen.getByText('TLP:AMBER')).toBeInTheDocument());
    expect(pageButton).toHaveAttribute('data-tlp', 'TLP:AMBER');
  });

  it('renames a page from Edit details', async () => {
    const { user } = await renderJournalWithNewPage();
    const pageButton = screen.getByText('Untitled Page').closest('button')!;

    fireEvent.contextMenu(pageButton, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.click(screen.getByRole('menuitem', { name: 'Edit details' }));
    await waitFor(() => expect(screen.getByText('Page details')).toBeInTheDocument());

    // getByDisplayValue would match both this modal's title input and the
    // page editor's own title field behind it (both show "Untitled Page") —
    // the modal's <label> wraps its <input>, so query by that label instead.
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Renamed Page');
    await user.tab(); // blur triggers the save

    await waitFor(async () => {
      const rows = await db.journalPages.toArray();
      expect(rows[0]?.title).toBe('Renamed Page');
    });
  });
});

describe('Journal books', () => {
  beforeEach(async () => {
    await db.journalPages.clear();
    await db.journalBooks.clear();
  });

  it('creates a personal book from the + menu and shows it as a header', async () => {
    const user = userEvent.setup();
    render(<JournalView folders={[]} onTearToInvestigation={async () => {}} />);
    const addBtn = await screen.findByTitle('New page or book');
    await user.click(addBtn);
    await user.click(await screen.findByRole('menuitem', { name: 'New book' }));

    await waitFor(() => expect(screen.getByText('New book')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/Ideas, Daily/), 'Ideas');
    await user.click(screen.getByRole('button', { name: 'Create book' }));

    await waitFor(() => expect(screen.getAllByText('Ideas').length).toBeGreaterThan(0));
    const books = await db.journalBooks.toArray();
    expect(books).toHaveLength(1);
    expect(books[0].name).toBe('Ideas');
    expect(books[0].investigationId).toBeUndefined();
  });

  it('moving a page into an investigation-bound book raises its displayed TLP to the investigation floor', async () => {
    const investigation = { id: 'inv1', name: 'Operation Foo', order: 0, createdAt: Date.now(), clsLevel: 'TLP:RED' };
    const user = userEvent.setup();
    render(<JournalView folders={[investigation]} onTearToInvestigation={async () => {}} />);

    // create the page first
    await clickNewPage(user);
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());

    // create an investigation-bound book
    const addBtn = await screen.findByTitle('New page or book');
    await user.click(addBtn);
    await user.click(await screen.findByRole('menuitem', { name: 'New book' }));
    await waitFor(() => expect(screen.getByText('New book')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/Ideas, Daily/), 'Case Book');
    const investigationSelect = screen.getByDisplayValue('Personal (no investigation)');
    await user.selectOptions(investigationSelect, 'Operation Foo');
    await user.click(screen.getByRole('button', { name: 'Create book' }));
    await waitFor(() => expect(screen.getByText('Case Book')).toBeInTheDocument());
    // book header shows the investigation annotation
    expect(screen.getByText('· Operation Foo')).toBeInTheDocument();

    // page has no TLP of its own yet
    const pageButton = screen.getByText('Untitled Page').closest('button')!;
    expect(pageButton).not.toHaveAttribute('data-tlp');

    // move the page into the investigation-bound book via Edit details
    fireEvent.contextMenu(pageButton, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.click(screen.getByRole('menuitem', { name: 'Edit details' }));
    await waitFor(() => expect(screen.getByText('Page details')).toBeInTheDocument());
    const bookSelect = screen.getByDisplayValue('Unfiled');
    await user.selectOptions(bookSelect, 'Case Book');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // the page never set its own TLP, but the investigation-bound book's
    // TLP:RED becomes a display floor — never silently downgraded.
    await waitFor(async () => {
      const rows = await db.journalPages.toArray();
      expect(rows[0]?.bookId).toBeTruthy();
    });
    await waitFor(() => {
      const btn = screen.getByText('Untitled Page').closest('button')!;
      expect(btn).toHaveAttribute('data-tlp', 'TLP:RED');
    });
    expect(screen.getByText('TLP:RED')).toBeInTheDocument();
  });

  it('deleting a book unfiles its pages instead of deleting them', async () => {
    const user = userEvent.setup();
    render(<JournalView folders={[]} onTearToInvestigation={async () => {}} />);
    await clickNewPage(user);
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());

    const addBtn = await screen.findByTitle('New page or book');
    await user.click(addBtn);
    await user.click(await screen.findByRole('menuitem', { name: 'New book' }));
    await waitFor(() => expect(screen.getByText('New book')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/Ideas, Daily/), 'Temp Book');
    await user.click(screen.getByRole('button', { name: 'Create book' }));
    await waitFor(() => expect(screen.getAllByText('Temp Book').length).toBeGreaterThan(0));

    const pageButton = screen.getByText('Untitled Page').closest('button')!;
    fireEvent.contextMenu(pageButton, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.click(screen.getByRole('menuitem', { name: 'Edit details' }));
    await waitFor(() => expect(screen.getByText('Page details')).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue('Unfiled'), 'Temp Book');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(async () => {
      const rows = await db.journalPages.toArray();
      expect(rows[0]?.bookId).toBeTruthy();
    });

    // delete the book via its own context menu
    const bookHeader = getBookHeader('Temp Book');
    fireEvent.contextMenu(bookHeader, { clientX: 50, clientY: 50 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.click(screen.getByRole('menuitem', { name: 'Delete book' }));

    await waitFor(async () => {
      const books = await db.journalBooks.toArray();
      expect(books).toHaveLength(0);
    });
    // the page survives, just unfiled
    const rows = await db.journalPages.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].bookId).toBeUndefined();
    expect(screen.getByText('Untitled Page')).toBeInTheDocument();
  });

  it('renames a book from its context menu', async () => {
    const user = userEvent.setup();
    render(<JournalView folders={[]} onTearToInvestigation={async () => {}} />);
    const addBtn = await screen.findByTitle('New page or book');
    await user.click(addBtn);
    await user.click(await screen.findByRole('menuitem', { name: 'New book' }));
    await waitFor(() => expect(screen.getByText('New book')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/Ideas, Daily/), 'Old Name');
    await user.click(screen.getByRole('button', { name: 'Create book' }));
    await waitFor(() => expect(screen.getAllByText('Old Name').length).toBeGreaterThan(0));

    const bookHeader = getBookHeader('Old Name');
    fireEvent.contextMenu(bookHeader, { clientX: 50, clientY: 50 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const renameInput = await screen.findByDisplayValue('Old Name');
    await user.clear(renameInput);
    await user.type(renameInput, 'New Name');
    await user.keyboard('{Enter}');

    await waitFor(async () => {
      const books = await db.journalBooks.toArray();
      expect(books[0]?.name).toBe('New Name');
    });
  });

  it('filters the page list to a single book via the book dropdown', async () => {
    const user = userEvent.setup();
    render(<JournalView folders={[]} onTearToInvestigation={async () => {}} />);

    expect(screen.queryByLabelText('Filter by book')).not.toBeInTheDocument();

    async function createBook(name: string) {
      await user.click(await screen.findByTitle('New page or book'));
      await user.click(await screen.findByRole('menuitem', { name: 'New book' }));
      await waitFor(() => expect(screen.getByText('New book')).toBeInTheDocument());
      await user.type(screen.getByPlaceholderText(/Ideas, Daily/), name);
      await user.click(screen.getByRole('button', { name: 'Create book' }));
      // Once the filter dropdown exists, the name matches both its <option>
      // and the list's book header, so assert presence via count, not getByText.
      await waitFor(() => expect(screen.getAllByText(name).length).toBeGreaterThan(0));
    }
    await createBook('Alpha Book');
    await createBook('Beta Book');

    // 'Alpha Book'/'Beta Book' text appears twice while both groups render:
    // once as the <option>, once as the list's book header.
    const filter = screen.getByLabelText('Filter by book');
    expect(screen.getAllByText('Alpha Book')).toHaveLength(2);
    expect(screen.getAllByText('Beta Book')).toHaveLength(2);

    await user.selectOptions(filter, 'Alpha Book');
    expect(screen.getAllByText('Alpha Book')).toHaveLength(2);
    // Beta's header is gone; only its <option> remains.
    expect(screen.getAllByText('Beta Book')).toHaveLength(1);

    await user.selectOptions(filter, 'All books');
    expect(screen.getAllByText('Alpha Book')).toHaveLength(2);
    expect(screen.getAllByText('Beta Book')).toHaveLength(2);
  });
});
