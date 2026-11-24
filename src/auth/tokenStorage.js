import * as SecureStore from "expo-secure-store";

export const tokenStorage = {
  async getItemAsync(key, options) {
    return SecureStore.getItemAsync(key, options);
  },
  async setItemAsync(key, value, options) {
    return SecureStore.setItemAsync(key, value, options);
  },
  async deleteItemAsync(key, options) {
    return SecureStore.deleteItemAsync(key, options);
  },
};
