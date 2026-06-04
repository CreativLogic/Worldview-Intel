// CI-only stub seeder. Emits a known-good GeoEntity[] payload under the
// plugin id provided via STUB_PLUGIN_ID. Used by plugin-CI to isolate
// frontend wiring from real backend health.
//
// NOTE: This bypasses ADR-0002's compile-time name rule on purpose — the
// data engine reads `name` once at load time, so an env-driven name is
// fine in CI. Do NOT copy this pattern into real seeders.

const pluginId = process.env.STUB_PLUGIN_ID;
// When unconfigured (e.g. seeder-CI, where this stub is baked into the shared
// :ci image but unused), export a nameless module so the seeder-loader skips
// it instead of crashing the engine.
//
// Uses the interval+fetch seeder contract: fetch() RETURNS the array and the
// scheduler auto-wraps it into a snapshot stored under the seeder id. The
// cron+fn contract would require the engine-internal setLiveSnapshot, which is
// NOT exposed on the seeder ctx (ctx is only { redis }).

function makeEntities() {
  const now = new Date().toISOString();
  return [
    {
      id: `${pluginId}-stub-1`,
      pluginId,
      latitude: 0,
      longitude: 0,
      altitude: 0,
      timestamp: now,
      label: "Stub entity 1",
      properties: { source: "ci-stub" },
    },
    {
      id: `${pluginId}-stub-2`,
      pluginId,
      latitude: 10,
      longitude: 10,
      altitude: 0,
      timestamp: now,
      label: "Stub entity 2",
      properties: { source: "ci-stub" },
    },
  ];
}

export default pluginId
  ? {
      name: pluginId,
      interval: 10000,
      fetch: async () => {
        const entities = makeEntities();
        console.log(`[stub-seeder] emitting ${entities.length} entities for ${pluginId}`);
        return entities;
      },
    }
  : {};
