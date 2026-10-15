import type { SecretStore } from "@loadstar/kernel";

/** Routes keys by prefix: matching keys go to `persistent`, everything else to `volatile`. */
export const createRoutedSecretStore = (
  prefixes: readonly string[],
  persistent: SecretStore,
  volatile: SecretStore,
): SecretStore => {
  const pick = (key: string) => (prefixes.some((prefix) => key.startsWith(prefix)) ? persistent : volatile);
  return {
    get: (key) => pick(key).get(key),
    set: (key, value) => pick(key).set(key, value),
    delete: (key) => pick(key).delete(key),
  };
};
