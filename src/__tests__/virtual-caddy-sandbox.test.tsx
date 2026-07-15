import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { VmSandboxBridge } from '../lib/bridges';

vi.mock('../lib/bridges', async () => {
  const actual = await vi.importActual<typeof import('../lib/bridges')>('../lib/bridges');
  return { ...actual, getVmSandboxBridge: vi.fn(), isDesktopBridge: vi.fn() };
});

import { getVmSandboxBridge, isDesktopBridge } from '../lib/bridges';
import { VirtualCaddySandbox } from '../components/VirtualCaddy/VirtualCaddySandbox';

function makeBridge(overrides: Partial<VmSandboxBridge> = {}): VmSandboxBridge {
  return {
    listVms: vi.fn(async () => ({ ok: true, vms: [{ name: 'Ubuntu Sandbox', uuid: 'uuid-1' }] })),
    listSnapshots: vi.fn(async () => ({ ok: true, snapshots: [{ name: 'Clean Base', uuid: 'snap-1' }] })),
    listNetworkAdapters: vi.fn(async () => ({ ok: true, adapters: ['vboxnet0'] })),
    saveGuestCredential: vi.fn(async () => ({ ok: true, credentialReferenceId: 'cred-ref-1' })),
    submitDetonation: vi.fn(async () => ({ ok: true, jobId: 'job-1' })),
    onJobStatus: vi.fn(() => () => {}),
    onJobComplete: vi.fn(() => () => {}),
    onJobError: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe('VirtualCaddySandbox', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(isDesktopBridge).mockReturnValue(false);
    vi.mocked(getVmSandboxBridge).mockReturnValue(null);
  });

  it('shows desktop-only fallback when not in Electron', () => {
    render(<VirtualCaddySandbox />);
    expect(screen.getByText(/requires the desktop app/i)).toBeInTheDocument();
  });

  it('loads VMs and network adapters, and populates snapshots once a VM is selected', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const bridge = makeBridge();
    vi.mocked(getVmSandboxBridge).mockReturnValue(bridge);

    render(<VirtualCaddySandbox />);
    await waitFor(() => expect(screen.getByText('Ubuntu Sandbox')).toBeInTheDocument());
    expect(screen.getByText('vboxnet0')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Virtual Machine/i), { target: { value: 'Ubuntu Sandbox' } });
    await waitFor(() => expect(bridge.listSnapshots).toHaveBeenCalledWith('Ubuntu Sandbox'));
    await waitFor(() => expect(screen.getByText('Clean Base')).toBeInTheDocument());
  });

  it('never renders a real-internet-egress option anywhere in the network mode UI', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    vi.mocked(getVmSandboxBridge).mockReturnValue(makeBridge());

    render(<VirtualCaddySandbox />);
    await waitFor(() => expect(screen.getByText('Fully isolated')).toBeInTheDocument());
    expect(screen.getByText('Simulated internet')).toBeInTheDocument();

    // Regression guard for the safety property: exactly two network-mode option
    // buttons exist, and neither is a real/NAT/bridged-egress choice. (The safety
    // banner text elsewhere in the component legitimately mentions "NAT"/"bridged" to
    // explain what's excluded, so this checks the actual interactive controls, not a
    // blanket string search over the whole page.)
    const networkSection = screen.getByRole('region', { name: 'Network mode' });
    const optionButtons = within(networkSection).getAllByRole('button');
    expect(optionButtons).toHaveLength(2);
    for (const btn of optionButtons) {
      expect(btn.textContent ?? '').not.toMatch(/real internet|\bnat\b|bridged/i);
    }
    expect(screen.getByText(/never gets real internet access/i)).toBeInTheDocument(); // the explicit safety banner IS expected
  });

  it('saves a guest credential and clears the password field afterward', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const bridge = makeBridge();
    vi.mocked(getVmSandboxBridge).mockReturnValue(bridge);

    render(<VirtualCaddySandbox />);
    await waitFor(() => expect(screen.getByText('Ubuntu Sandbox')).toBeInTheDocument());

    const userInput = screen.getByPlaceholderText('Guest username') as HTMLInputElement;
    const passInput = screen.getByPlaceholderText('Guest password') as HTMLInputElement;
    fireEvent.change(userInput, { target: { value: 'analyst' } });
    fireEvent.change(passInput, { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(bridge.saveGuestCredential).toHaveBeenCalledWith('analyst', 'hunter2'));
    await waitFor(() => expect(passInput.value).toBe(''));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('keeps Detonate disabled until VM, snapshot, adapter, sample, and credential are all set', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const bridge = makeBridge();
    vi.mocked(getVmSandboxBridge).mockReturnValue(bridge);

    render(<VirtualCaddySandbox />);
    await waitFor(() => expect(screen.getByText('Ubuntu Sandbox')).toBeInTheDocument());

    const detonateButton = screen.getByRole('button', { name: /detonate/i });
    expect(detonateButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Virtual Machine/i), { target: { value: 'Ubuntu Sandbox' } });
    await waitFor(() => expect(screen.getByText('Clean Base')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Clean Snapshot/i), { target: { value: 'Clean Base' } });
    fireEvent.change(screen.getByLabelText(/Host-only Adapter/i), { target: { value: 'vboxnet0' } });
    expect(detonateButton).toBeDisabled(); // still no sample or credential

    fireEvent.change(screen.getByPlaceholderText('Guest username'), { target: { value: 'analyst' } });
    fireEvent.change(screen.getByPlaceholderText('Guest password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
    expect(detonateButton).toBeDisabled(); // still no sample dropped

    const dropZone = screen.getByRole('region', { name: /drop zone for a sample/i });
    const file = new File(['x'], 'sample.exe', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'path', { value: '/tmp/sample.exe' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(detonateButton).not.toBeDisabled());
  });

  it('submits a detonation and reflects job status updates', async () => {
    vi.mocked(isDesktopBridge).mockReturnValue(true);
    const bridge = makeBridge();
    vi.mocked(getVmSandboxBridge).mockReturnValue(bridge);

    render(<VirtualCaddySandbox />);
    await waitFor(() => expect(screen.getByText('Ubuntu Sandbox')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Virtual Machine/i), { target: { value: 'Ubuntu Sandbox' } });
    await waitFor(() => expect(screen.getByText('Clean Base')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Clean Snapshot/i), { target: { value: 'Clean Base' } });
    fireEvent.change(screen.getByLabelText(/Host-only Adapter/i), { target: { value: 'vboxnet0' } });
    fireEvent.change(screen.getByPlaceholderText('Guest username'), { target: { value: 'analyst' } });
    fireEvent.change(screen.getByPlaceholderText('Guest password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());

    const dropZone = screen.getByRole('region', { name: /drop zone for a sample/i });
    const file = new File(['x'], 'sample.exe', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'path', { value: '/tmp/sample.exe' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    const detonateButton = screen.getByRole('button', { name: /detonate/i });
    await waitFor(() => expect(detonateButton).not.toBeDisabled());
    fireEvent.click(detonateButton);

    await waitFor(() => expect(bridge.submitDetonation).toHaveBeenCalledWith(expect.objectContaining({
      vmName: 'Ubuntu Sandbox',
      snapshotName: 'Clean Base',
      hostOnlyAdapter: 'vboxnet0',
      networkMode: 'isolated',
      filePath: '/tmp/sample.exe',
      credentialReferenceId: 'cred-ref-1',
    })));
    expect(screen.getByText('sample.exe')).toBeInTheDocument();
    expect(screen.getByText('queued')).toBeInTheDocument();
  });
});
