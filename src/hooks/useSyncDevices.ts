import { useState, useCallback } from 'react';
import type { SyncDevice } from '../types';
import {
  fetchSyncDevices,
  revokeSyncDevice,
  renameSyncDevice,
  generatePairingCode,
  completePairing,
  registerSyncDevice,
  getOrCreateDeviceKey,
  getDeviceName,
} from '../lib/server-api';

export interface PairingState {
  pairingCode: string;
  qrDataUrl: string;
  expiresAt: string;
}

export function useSyncDevices() {
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingState | null>(null);

  const currentDeviceKey = getOrCreateDeviceKey();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { devices: list } = await fetchSyncDevices();
      setDevices(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  const revoke = useCallback(async (deviceId: string) => {
    await revokeSyncDevice(deviceId);
    setDevices((prev) => prev.map((d) => d.id === deviceId ? { ...d, status: 'revoked' as const } : d));
  }, []);

  const rename = useCallback(async (deviceId: string, name: string) => {
    await renameSyncDevice(deviceId, name);
    setDevices((prev) => prev.map((d) => d.id === deviceId ? { ...d, deviceName: name } : d));
  }, []);

  const startPairing = useCallback(async () => {
    const result = await generatePairingCode();
    setPairing(result);
    return result;
  }, []);

  const cancelPairing = useCallback(() => setPairing(null), []);

  const redeemPairingCode = useCallback(async (code: string): Promise<{ enrolled: boolean }> => {
    const deviceKey = getOrCreateDeviceKey();
    const deviceName = getDeviceName();
    const result = await completePairing(code, deviceKey, deviceName);
    return result;
  }, []);

  const enrollThisDevice = useCallback(async (): Promise<{ status: 'approved' | 'pending' }> => {
    const deviceKey = getOrCreateDeviceKey();
    const deviceName = getDeviceName();
    const result = await registerSyncDevice(deviceKey, deviceName);
    return result;
  }, []);

  return {
    devices,
    loading,
    error,
    pairing,
    currentDeviceKey,
    load,
    revoke,
    rename,
    startPairing,
    cancelPairing,
    redeemPairingCode,
    enrollThisDevice,
  };
}
