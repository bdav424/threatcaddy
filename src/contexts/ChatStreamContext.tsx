/* eslint-disable react-refresh/only-export-components -- context + provider + hook co-located by design */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

export interface ChatStreamState {
  isStreaming: boolean;
  streamingThreadId: string | null;
  streamingContent: string;
  abort: (() => void) | null;
}

interface ChatStreamContextValue extends ChatStreamState {
  setChatStream: (patch: Partial<ChatStreamState>) => void;
}

const ChatStreamContext = createContext<ChatStreamContextValue | null>(null);

const IDLE: ChatStreamState = {
  isStreaming: false,
  streamingThreadId: null,
  streamingContent: '',
  abort: null,
};

export function ChatStreamProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChatStreamState>(IDLE);

  const setChatStream = useCallback((patch: Partial<ChatStreamState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ ...state, setChatStream }),
    [state, setChatStream],
  );

  return (
    <ChatStreamContext.Provider value={value}>
      {children}
    </ChatStreamContext.Provider>
  );
}

/** Read the global streaming state (e.g. to show a header indicator). */
export function useChatStream() {
  const ctx = useContext(ChatStreamContext);
  if (!ctx) throw new Error('useChatStream must be used within ChatStreamProvider');
  return ctx;
}

/** Used exclusively by ChatView to push streaming state into the global context. */
export function useChatStreamSetter() {
  const ctx = useContext(ChatStreamContext);
  if (!ctx) throw new Error('useChatStreamSetter must be used within ChatStreamProvider');
  return ctx.setChatStream;
}
