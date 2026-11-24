const memoryStore = new Map();

function getStorage() {
  if (
    typeof window !== "undefined" &&
    window.localStorage &&
    typeof window.localStorage.getItem === "function"
  ) {
    return window.localStorage;
  }
  return null;
}

export const tokenStorage = {
  async getItemAsync(key) {
    const storage = getStorage();
    if (!storage) {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    }
    try {
      return storage.getItem(key);
    } catch {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    }
  },
  async setItemAsync(key, value) {
    const storage = getStorage();
    if (!storage) {
      memoryStore.set(key, String(value));
      return;
    }
    try {
      storage.setItem(key, String(value));
    } catch {
      memoryStore.set(key, String(value));
    }
  },
  async deleteItemAsync(key) {
    const storage = getStorage();
    if (!storage) {
      memoryStore.delete(key);
      return;
    }
    try {
      storage.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};
