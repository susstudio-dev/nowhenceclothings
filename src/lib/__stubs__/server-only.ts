// `server-only` throws when imported outside a server bundle, which would make
// every unit test that touches a server module fail on import. Vitest aliases
// the package to this empty stub (see vitest.config.mts). Nothing else should
// import it.
export {};
