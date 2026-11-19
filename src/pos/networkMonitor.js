/**
 * Network reconnect monitor untuk POS.
 * Mendeteksi transisi koneksi dari offline ke online dan memicu sinkronisasi
 * secara single-flight dan anti-debounce.
 */
export function createNetworkMonitor({
  getNetworkStateAsync,
  onReconnect,
  onStatusChange,
  intervalMs = 4000,
}) {
  let isRunning = false;
  let timerId = null;
  let lastConnected = null;
  let isTriggering = false;

  async function check() {
    if (!isRunning) return;
    try {
      const state = await getNetworkStateAsync();
      const isConnected = Boolean(state?.isConnected && state?.isInternetReachable !== false);

      if (lastConnected !== null && lastConnected !== isConnected) {
        if (onStatusChange) {
          onStatusChange(isConnected);
        }

        // Transisi dari offline (false) ke online (true)
        if (!lastConnected && isConnected) {
          if (!isTriggering && onReconnect) {
            isTriggering = true;
            try {
              await onReconnect();
            } catch (err) {
              // Error sinkronisasi ditangani di level sync service
            } finally {
              isTriggering = false;
            }
          }
        }
      } else if (lastConnected === null && onStatusChange) {
        onStatusChange(isConnected);
      }

      lastConnected = isConnected;
    } catch {
      if (lastConnected !== false) {
        lastConnected = false;
        if (onStatusChange) onStatusChange(false);
      }
    }
  }

  return {
    start() {
      if (isRunning) return;
      isRunning = true;
      // Cek awal segera
      check();
      timerId = setInterval(check, intervalMs);
    },
    stop() {
      isRunning = false;
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    },
    // Method untuk simulasi manual pada unit testing
    async triggerCheck() {
      await check();
    },
    getStatus() {
      return { isRunning, lastConnected };
    },
  };
}
