import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ListChecks, CheckSquare, LayoutGrid, Plus, Filter, ArrowUpDown } from 'lucide-react';
import type { Task, Note, TimelineEvent, TaskStatus, Tag, Folder, InvestigationMember } from '../../types';
import { TaskItem } from './TaskItem';
import { TaskForm } from './TaskForm';
import { KanbanBoard } from './KanbanBoard';
import { Modal } from '../Common/Modal';
import { cn } from '../../lib/utils';
import { Virtuoso } from 'react-virtuoso';
import { useNavigation } from '../../contexts/NavigationContext';
import { useInvestigation } from '../../contexts/InvestigationContext';
import { useWorkspacePanelChromeState, useWorkspacePanelHeaderAccessory } from '../WorkspacePanels/WorkspacePanel';

interface TaskListProps {
  tasks: Task[];
  allTags: Tag[];
  folders: Folder[];
  onCreateTag: (name: string) => Promise<Tag>;
  onToggleComplete: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onTrashTask?: (id: string) => void;
  onRestoreTask?: (id: string) => void;
  onToggleArchiveTask?: (id: string) => void;
  onCreateTask: (data: Partial<Task>) => void;
  getTasksByStatus: (status: TaskStatus) => Task[];
  allNotes?: Note[];
  allTimelineEvents?: TimelineEvent[];
  scopeLabel?: string;
  members?: InvestigationMember[];
  currentUserId?: string;
}

export function TaskListView({
  tasks,
  allTags,
  folders,
  onCreateTag,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
  onTrashTask,
  onRestoreTask,
  onToggleArchiveTask,
  onCreateTask,
  getTasksByStatus,
  allNotes,
  allTimelineEvents,
  scopeLabel,
  members,
  currentUserId,
}: TaskListProps) {
  const { taskViewMode: viewMode, setTaskViewMode: onViewModeChange, pendingNewTask: openNewForm, setPendingNewTask } = useNavigation();
  const { selectedFolderId } = useInvestigation();
  const { t } = useTranslation('tasks');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);

  // Open creation form when triggered externally (e.g. from header "+ New" dropdown)
  useEffect(() => {
    if (!openNewForm) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncing external prop to local modal state
    setShowNewTask(true);
    setPendingNewTask(false);
  }, [openNewForm, setPendingNewTask]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'order' | 'dueDate' | 'priority' | 'updatedAt'>('order');
  const workspacePanelChrome = useWorkspacePanelChromeState();
  const compactTitlebarMode = Boolean(workspacePanelChrome?.compact);

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (assigneeFilter === '__me__' && t.assigneeId !== currentUserId) return false;
      if (assigneeFilter && assigneeFilter !== '__me__' && t.assigneeId !== assigneeFilter) return false;
      return true;
    });

    if (sortBy === 'order') return filtered;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === 'priority') {
        const order = { high: 0, medium: 1, low: 2, none: 3 };
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
      }
      if (sortBy === 'updatedAt') {
        return b.updatedAt - a.updatedAt;
      }
      return 0;
    });
  }, [tasks, statusFilter, assigneeFilter, currentUserId, sortBy]);

  const handleSelect = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) setEditingTask(task);
  };

  const handleSaveEdit = (data: Partial<Task>) => {
    if (editingTask) {
      onUpdateTask(editingTask.id, data);
      setEditingTask(null);
    }
  };

  const handleSaveNew = (data: Partial<Task>) => {
    onCreateTask(data);
    setShowNewTask(false);
  };

  const taskTitlebarControls = useMemo(() => {
    if (!compactTitlebarMode) return null;

    return (
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1" data-task-titlebar-controls="true">
        <div className="flex shrink-0 items-center gap-0.5" data-task-titlebar-view-toggle="true">
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={cn('flex h-6 w-6 items-center justify-center rounded-[8px]', viewMode === 'list' ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary')}
            title={t('list.listView')}
            aria-label={t('list.listView')}
          >
            <ListChecks size={13} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('kanban')}
            className={cn('flex h-6 w-6 items-center justify-center rounded-[8px]', viewMode === 'kanban' ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary')}
            title={t('list.kanbanView')}
            aria-label={t('list.kanbanView')}
          >
            <LayoutGrid size={13} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowNewTask(true)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border border-accent/30 bg-accent/14 text-accent transition-colors hover:bg-accent/20"
          aria-label={t('list.newTaskAria')}
          title={t('list.newTask')}
          data-task-new-button="true"
        >
          <Plus size={13} />
        </button>
      </div>
    );
  }, [compactTitlebarMode, onViewModeChange, t, viewMode]);
  const taskTitlebarAccessory = useMemo(
    () => taskTitlebarControls ? { content: taskTitlebarControls, replaceTitle: true } : null,
    [taskTitlebarControls],
  );
  useWorkspacePanelHeaderAccessory(taskTitlebarAccessory);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" data-task-list="true">
      {/* Toolbar */}
      <div
        className={cn('flex items-center gap-1.5 px-3 py-2 border-b border-gray-800 shrink-0', compactTitlebarMode && 'hidden')}
        data-task-toolbar="true"
      >
        <span className="text-sm font-medium text-gray-300 hidden sm:inline" data-task-toolbar-title="true">
          {scopeLabel ? t('list.titleWithScope', { scope: scopeLabel, count: tasks.length }) : t('list.titleWithCount', { count: tasks.length })}
        </span>
        <span className="text-sm font-medium text-gray-300 sm:hidden" data-task-toolbar-count="true">{tasks.length}</span>

        <div className="flex items-center gap-0.5 ms-1" data-task-view-toggle="true">
          <button
            onClick={() => onViewModeChange('list')}
            className={cn('p-1 rounded', viewMode === 'list' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300')}
            title={t('list.listView')}
            aria-label={t('list.listView')}
          >
            <ListChecks size={16} />
          </button>
          <button
            onClick={() => onViewModeChange('kanban')}
            className={cn('p-1 rounded', viewMode === 'kanban' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300')}
            title={t('list.kanbanView')}
            aria-label={t('list.kanbanView')}
          >
            <LayoutGrid size={16} />
          </button>
        </div>

        {viewMode === 'list' && (
          <div className="flex items-center gap-1 ms-1" data-task-toolbar-filters="true">
            <Filter size={14} className="text-gray-500 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-300 focus:outline-none"
              aria-label={t('list.filterByStatus')}
            >
              <option value="">{t('list.filterAll')}</option>
              <option value="todo">{t('status.todo')}</option>
              <option value="in-progress">{t('status.inProgress')}</option>
              <option value="done">{t('status.done')}</option>
            </select>
            <ArrowUpDown size={14} className="text-gray-500 hidden sm:block ms-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-300 focus:outline-none"
              aria-label={t('list.sortBy')}
            >
              <option value="order">{t('list.sortDefault')}</option>
              <option value="dueDate">{t('list.sortDueDate')}</option>
              <option value="priority">{t('list.sortPriority')}</option>
              <option value="updatedAt">{t('list.sortLastUpdated')}</option>
            </select>
            {members && members.length > 0 && (
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-300 focus:outline-none"
                aria-label={t('list.filterByAssignee')}
              >
                <option value="">{t('list.allAssignees')}</option>
                {currentUserId && <option value="__me__">{t('list.assignedToMe')}</option>}
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.displayName}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <button
          onClick={() => setShowNewTask(true)}
          className="ms-auto flex h-8 items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
          aria-label={t('list.newTaskAria')}
          data-task-new-button={compactTitlebarMode ? undefined : 'true'}
        >
          <Plus size={13} />
          <span className="hidden sm:inline" data-task-new-button-label={compactTitlebarMode ? undefined : 'true'}>{t('list.newTask')}</span>
        </button>
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1',
          compactTitlebarMode ? 'p-2' : 'p-4',
          viewMode === 'list' ? 'overflow-hidden' : 'overflow-y-auto',
        )}
        data-task-content="true"
      >
        {viewMode === 'list' ? (
          <div className={cn('h-full', compactTitlebarMode ? 'max-w-none' : 'mx-auto max-w-3xl')}>
            {filteredTasks.length === 0 ? (
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-3 text-gray-500',
                  compactTitlebarMode ? 'h-full min-h-[120px] px-2 py-4 text-center' : 'py-16',
                )}
                data-task-empty-state="true"
              >
                <CheckSquare size={compactTitlebarMode ? 28 : 40} strokeWidth={1.5} className="text-gray-600" data-task-empty-icon="true" />
                <p className={cn('text-sm', compactTitlebarMode && 'max-w-[18rem] text-xs leading-5')} data-task-empty-copy="true">{t('emptyState')}</p>
                <button
                  onClick={() => setShowNewTask(true)}
                  className={cn(
                    'rounded-lg bg-accent/10 font-medium text-accent transition-colors hover:bg-accent/20',
                    compactTitlebarMode ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
                  )}
                  data-task-empty-button="true"
                >
                  {t('createFirst')}
                </button>
              </div>
            ) : compactTitlebarMode ? (
              <div className="h-full space-y-1 overflow-y-auto pe-1" data-task-compact-list="true">
                {filteredTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onSelect={handleSelect}
                    onDelete={onDeleteTask}
                    onTrash={onTrashTask}
                    onRestore={onRestoreTask}
                    onToggleArchive={onToggleArchiveTask}
                    onUpdateTask={onUpdateTask}
                    members={members}
                    compact
                  />
                ))}
              </div>
            ) : (
              <Virtuoso
                data={filteredTasks}
                itemContent={(_index, task) => (
                  <div className="pb-1.5">
                    <TaskItem
                      task={task}
                      onToggleComplete={onToggleComplete}
                      onSelect={handleSelect}
                      onDelete={onDeleteTask}
                      onTrash={onTrashTask}
                      onRestore={onRestoreTask}
                      onToggleArchive={onToggleArchiveTask}
                      onUpdateTask={onUpdateTask}
                      members={members}
                      compact={false}
                    />
                  </div>
                )}
              />
            )}
          </div>
        ) : (
          <KanbanBoard
            getTasksByStatus={getTasksByStatus}
            onToggleComplete={onToggleComplete}
            onSelect={handleSelect}
            onDelete={onDeleteTask}
            onUpdateTask={onUpdateTask}
          />
        )}
      </div>

      {/* Edit Task Modal */}
      <Modal open={editingTask !== null} onClose={() => setEditingTask(null)} title={t('list.editTaskModal')} wide>
        {editingTask && (
          <TaskForm
            task={editingTask}
            folders={folders}
            allTags={allTags}
            onCreateTag={onCreateTag}
            onSave={handleSaveEdit}
            onCancel={() => setEditingTask(null)}
            onUpdateTask={(id, updates) => {
              onUpdateTask(id, updates);
              setEditingTask((prev) => prev && prev.id === id ? { ...prev, ...updates } : prev);
            }}
            onDelete={(id) => { onDeleteTask(id); setEditingTask(null); }}
            allNotes={allNotes}
            allTimelineEvents={allTimelineEvents}
            investigationMembers={members}
          />
        )}
      </Modal>

      {/* New Task Modal */}
      <Modal open={showNewTask} onClose={() => setShowNewTask(false)} title={t('list.createTaskModal')} wide>
        <TaskForm
          folders={folders}
          allTags={allTags}
          onCreateTag={onCreateTag}
          onSave={handleSaveNew}
          onCancel={() => setShowNewTask(false)}
          defaultFolderId={selectedFolderId}
          investigationMembers={members}
        />
      </Modal>

    </div>
  );
}
