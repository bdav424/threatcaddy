import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Note } from '../types';
import { NoteList } from '../components/Notes/NoteList';
import { NoteEditor } from '../components/Notes/NoteEditor';
import { WorkspacePanel } from '../components/WorkspacePanels/WorkspacePanel';
import { WorkspacePanelProvider } from '../components/WorkspacePanels/WorkspacePanelProvider';

function makeNote(id: string, title: string, updatedAt: number): Note {
  return {
    id,
    title,
    content: `${title} body`,
    tags: [],
    pinned: false,
    archived: false,
    trashed: false,
    createdAt: updatedAt - 100,
    updatedAt,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('compact Notes workspace history', () => {
  it('shows a titlebar note selector that switches existing notes', async () => {
    const onSelect = vi.fn();
    const notes = [
      makeNote('note-new', 'Current compact note', 300),
      makeNote('note-old', 'Older investigation note', 200),
      { ...makeNote('folder-1', 'Folder container', 100), isFolder: true },
    ];

    render(
      <WorkspacePanelProvider
        initialPanels={[{
          id: 'notes-workspace-test',
          title: 'Notes',
          mode: 'floating',
          geometry: { x: 24, y: 24, width: 340, height: 260 },
        }]}
      >
        <WorkspacePanel
          id="notes-workspace-test"
          title="Notes"
          mode="floating"
          geometry={{ x: 24, y: 24, width: 340, height: 260 }}
          onModeChange={() => {}}
          onGeometryChange={() => {}}
          active
          minWidth={320}
          minHeight={240}
          compactWidth={620}
          compactHeight={420}
          resizeLabelBase="Notes panel"
          floatingAriaLabel="Notes panel"
        >
          <NoteList
            notes={notes}
            selectedId="note-new"
            onSelect={onSelect}
            sort="updatedAt"
            onSortChange={() => {}}
            onCreate={() => {}}
          />
        </WorkspacePanel>
      </WorkspacePanelProvider>,
    );

    const selector = await screen.findByLabelText('Select existing note');
    await waitFor(() => {
      expect(document.querySelector('[data-note-history-selector="true"]')).toBeInTheDocument();
    });
    expect(selector).toHaveValue('note-new');
    expect(screen.getByRole('option', { name: 'Older investigation note' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Folder container' })).not.toBeInTheDocument();

    fireEvent.change(selector, { target: { value: 'note-old' } });

    expect(onSelect).toHaveBeenCalledWith('note-old');
  });

  it('applies pending compact editor changes before returning to the selector path', async () => {
    const onUpdate = vi.fn();
    const onBack = vi.fn();
    const note = makeNote('note-apply', 'Draft note', 400);
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    render(
      <WorkspacePanelProvider
        initialPanels={[{
          id: 'notes-workspace-editor-test',
          title: 'Notes',
          mode: 'floating',
          geometry: { x: 24, y: 24, width: 340, height: 260 },
        }]}
      >
        <WorkspacePanel
          id="notes-workspace-editor-test"
          title="Notes"
          mode="floating"
          geometry={{ x: 24, y: 24, width: 340, height: 260 }}
          onModeChange={() => {}}
          onGeometryChange={() => {}}
          active
          minWidth={320}
          minHeight={240}
          compactWidth={620}
          compactHeight={420}
          resizeLabelBase="Notes panel"
          floatingAriaLabel="Notes panel"
        >
          <NoteEditor
            note={note}
            onUpdate={onUpdate}
            onTrash={() => {}}
            onRestore={() => {}}
            onTogglePin={() => {}}
            onToggleArchive={() => {}}
            allTags={[]}
            folders={[]}
            onCreateTag={async (name) => ({ id: 'tag-1', name, color: '#ffffff' })}
            editorMode="edit"
            onEditorModeChange={() => {}}
            onBack={onBack}
            allNotes={[note]}
          />
        </WorkspacePanel>
      </WorkspacePanelProvider>,
    );

    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Applied compact note' } });
    fireEvent.change(screen.getByLabelText('Note content editor'), { target: { value: 'Applied compact body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply / Back to notes list' }));

    expect(onUpdate).toHaveBeenCalledWith('note-apply', {
      title: 'Applied compact note',
      content: 'Applied compact body',
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
