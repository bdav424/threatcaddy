import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../components/Chat/ChatInput';

const defaultProps = {
  onSend: vi.fn(),
  onStop: vi.fn(),
  isStreaming: false,
  extensionAvailable: true,
  model: 'claude-sonnet-4-6',
  onModelChange: vi.fn(),
  configuredProviders: new Set(['anthropic', 'openai', 'gemini', 'mistral']),
};

describe('ChatInput', () => {
  it('renders provider pill buttons for configured providers', () => {
    render(<ChatInput {...defaultProps} />);
    // ProviderModelPicker renders provider pills as buttons
    expect(screen.getByRole('button', { name: /Claude/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GPT/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gemini/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mistral/i })).toBeInTheDocument();
  });

  it('marks the active provider pill as pressed', () => {
    render(<ChatInput {...defaultProps} model="claude-sonnet-4-6" />);
    const claudePill = screen.getByRole('button', { name: /Claude/i });
    expect(claudePill).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a model select when the active provider has multiple models', () => {
    render(<ChatInput {...defaultProps} model="claude-sonnet-4-6" />);
    // Anthropic has multiple models so a combobox should appear
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('calls onModelChange when selecting a different model', () => {
    const onModelChange = vi.fn();
    render(<ChatInput {...defaultProps} onModelChange={onModelChange} model="claude-sonnet-4-6" />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'claude-opus-4-6' } });
    expect(onModelChange).toHaveBeenCalledWith('claude-opus-4-6', 'anthropic');
  });

  it('calls onModelChange with first model when switching provider via pill', () => {
    const onModelChange = vi.fn();
    render(<ChatInput {...defaultProps} onModelChange={onModelChange} model="claude-sonnet-4-6" />);
    const gptPill = screen.getByRole('button', { name: /GPT/i });
    fireEvent.click(gptPill);
    // Should call with the first OpenAI model
    expect(onModelChange).toHaveBeenCalledWith(expect.stringContaining('gpt'), 'openai');
  });

  it('shows local provider pill when local endpoint is configured', () => {
    render(
      <ChatInput
        {...defaultProps}
        configuredProviders={new Set(['local'])}
        localModelName="llama3"
        model="llama3"
      />,
    );
    expect(screen.getByRole('button', { name: /Local/i })).toBeInTheDocument();
  });

  it('does not show local provider when not configured', () => {
    render(
      <ChatInput
        {...defaultProps}
        configuredProviders={new Set(['anthropic'])}
      />,
    );
    expect(screen.queryByRole('button', { name: /Local/i })).not.toBeInTheDocument();
  });

  it('shows no-provider message when no providers configured', () => {
    render(<ChatInput {...defaultProps} configuredProviders={new Set()} />);
    expect(screen.getByText(/No provider configured/i)).toBeInTheDocument();
  });

  it('shows Stop button when streaming', () => {
    render(<ChatInput {...defaultProps} isStreaming={true} />);
    const stopButton = screen.getByTitle('Stop generating');
    expect(stopButton).toBeInTheDocument();
  });

  it('shows Send button when not streaming', () => {
    render(<ChatInput {...defaultProps} isStreaming={false} />);
    const sendButton = screen.getByTitle('Send message (Enter)');
    expect(sendButton).toBeInTheDocument();
  });

  it('disables textarea when extension is unavailable', () => {
    render(<ChatInput {...defaultProps} extensionAvailable={false} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('disables textarea when disabled prop is true', () => {
    render(<ChatInput {...defaultProps} disabled={true} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('shows extension connected indicator', () => {
    render(<ChatInput {...defaultProps} extensionAvailable={true} />);
    expect(screen.getByText('Extension')).toBeInTheDocument();
  });

  it('shows no extension indicator', () => {
    render(<ChatInput {...defaultProps} extensionAvailable={false} />);
    expect(screen.getByText('No connection')).toBeInTheDocument();
  });

  it('calls onSend with trimmed text on Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  Hello world  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Hello world');
  });
});
