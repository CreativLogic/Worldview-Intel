/**
 * ci-plugin-smoke/smoke.mjs
 * Tier 2: Load the bundle and verify WorldPlugin interface shape.
 * Tier 3: Exercise pure methods — getLayerConfig, renderEntity, mapWebsocketPayload.
 *
 * Plugin bundles reference globalThis.__WWV_HOST__ for all externals (React, Cesium,
 * wwv-plugin-sdk, etc.) via the wwvPluginGlobals() Vite plugin. No Node.js module
 * hooks are needed — setting up __WWV_HOST__ before import() is sufficient.
 *
 * Usage: node scripts/ci-plugin-smoke/smoke.mjs <path-to-dist/frontend.mjs>
 */

import { pathToFileURL } from "node:url";
import path from "node:path";

// ── Args ─────────────────────────────────────────────────────────────────────
const [, , bundleArg] = process.argv;
if (!bundleArg) {
  console.error("Usage: node scripts/ci-plugin-smoke/smoke.mjs <path-to-dist/frontend.mjs>");
  process.exit(2);
}
const bundleAbs = path.resolve(bundleArg);
const bundleUrl = pathToFileURL(bundleAbs).href;

// ── Mock host globals ─────────────────────────────────────────────────────────
// Mirrors what the host app injects at runtime. All externals in the bundle
// resolve to these via globalThis.__WWV_HOST__.<name>.
const noop = () => {};

globalThis.__WWV_HOST__ = {
  React: new Proxy(
    {
      createElement: () => null,
      Fragment: Symbol("Fragment"),
      memo: (c) => c,
      forwardRef: (fn) => fn,
      lazy: () => null,
      createContext: () => ({ Provider: null, Consumer: null, _currentValue: null }),
      Component: class Component {},
      PureComponent: class PureComponent {},
    },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (["useState", "useRef", "useContext", "useReducer"].includes(key)) return () => [null, noop];
        if (["useEffect", "useLayoutEffect", "useInsertionEffect"].includes(key)) return noop;
        if (["useMemo", "useCallback"].includes(key)) return (fn) => (typeof fn === "function" ? fn() : fn);
        return noop;
      },
    }
  ),
  ReactDOM: { createPortal: () => null, flushSync: (fn) => fn(), render: noop },
  jsxRuntime: { jsx: () => null, jsxs: () => null, Fragment: null },
  Cesium: new Proxy(
    {},
    {
      get(_, key) {
        if (key === "Math") return Math;
        if (key === Symbol.toPrimitive) return undefined;
        return function MockCesium() {};
      },
    }
  ),
  Resium: new Proxy({}, { get: () => function MockResium() {} }),
  WWVPluginSDK: {
    createSvgIconUrl: () => "data:image/svg+xml;base64,PHN2Zy8+",
    DEFAULT_ICON_SIZE: 32,
    dtProp: (v) => (v ? `datetime:${v}` : null),
    urlProp: (v) => (v ? `url:${v}` : null),
    imageProp: (v) => (v ? `image:${v}` : null),
    videoProp: (v) => (v ? `video:${v}` : null),
  },
  zustand: {
    create: () => Object.assign(() => ({}), { getState: () => ({}), setState: noop, subscribe: () => noop }),
    createStore: () => ({ getState: () => ({}), setState: noop, subscribe: () => noop }),
  },
  useStore: () => ({}),
  pluginManager: { getPlugin: () => null, registerPlugin: noop },
  CameraStream: null,
};

// No-op fetch so any top-level module code that calls fetch() does not throw.
globalThis.fetch ??= async () => ({ ok: true, status: 200, json: async () => [], text: async () => "[]" });

// ── Load the bundle ───────────────────────────────────────────────────────────
let mod;
try {
  mod = await import(bundleUrl);
} catch (err) {
  console.error(`FAIL [Tier 2] Bundle failed to load: ${err.message}`);
  process.exit(1);
}

// ── Instantiate (mirrors loadBundlePlugin logic) ──────────────────────────────
function tryInstantiate(maybeExport) {
  if (!maybeExport) return null;
  if (typeof maybeExport === "function") {
    try {
      const inst = new maybeExport();
      if (inst && typeof inst.initialize === "function") return inst;
    } catch {
      return null;
    }
  }
  if (typeof maybeExport === "object" && typeof maybeExport.initialize === "function") return maybeExport;
  return null;
}

let plugin = null;
if (mod.default) {
  plugin = typeof mod.default === "function"
    ? (tryInstantiate(mod.default) ?? new mod.default())
    : mod.default;
}
if (!plugin) {
  for (const k of Object.keys(mod)) {
    plugin = tryInstantiate(mod[k]);
    if (plugin) break;
  }
}

if (!plugin) {
  console.error("FAIL [Tier 2] No valid WorldPlugin export found in bundle.");
  process.exit(1);
}
console.log("OK   [Tier 2] Bundle loaded and plugin instantiated");

// ── Tier 2: Required interface fields ────────────────────────────────────────
const REQUIRED_STRINGS = ["id", "name", "description", "category", "version"];
const REQUIRED_METHODS = ["initialize", "destroy", "fetch", "getPollingInterval", "getLayerConfig", "renderEntity"];
let passed = true;

for (const field of REQUIRED_STRINGS) {
  if (typeof plugin[field] !== "string" || !plugin[field]) {
    console.error(`FAIL [Tier 2] Missing or empty string field: "${field}" (got ${JSON.stringify(plugin[field])})`);
    passed = false;
  } else {
    console.log(`  ok   ${field} = ${JSON.stringify(plugin[field])}`);
  }
}
for (const method of REQUIRED_METHODS) {
  if (typeof plugin[method] !== "function") {
    console.error(`FAIL [Tier 2] Missing required method: ${method}()`);
    passed = false;
  } else {
    console.log(`  ok   ${method}()`);
  }
}

if (!passed) {
  console.error("FAIL [Tier 2] WorldPlugin shape validation failed — see above");
  process.exit(1);
}
console.log("OK   [Tier 2] WorldPlugin interface shape validated");

// ── Tier 3: Exercise pure methods ─────────────────────────────────────────────
// These methods must be callable without a real engine or network.

// getPollingInterval()
try {
  const interval = plugin.getPollingInterval();
  if (typeof interval !== "number" || interval < 0) {
    console.error(`FAIL [Tier 3] getPollingInterval() returned invalid value: ${JSON.stringify(interval)}`);
    passed = false;
  } else {
    console.log(`  ok   getPollingInterval() = ${interval}`);
  }
} catch (err) {
  console.error(`FAIL [Tier 3] getPollingInterval() threw: ${err.message}`);
  passed = false;
}

// getLayerConfig()
let layerConfig;
try {
  layerConfig = plugin.getLayerConfig();
  if (!layerConfig || typeof layerConfig !== "object") {
    console.error(`FAIL [Tier 3] getLayerConfig() returned non-object: ${JSON.stringify(layerConfig)}`);
    passed = false;
  } else if (typeof layerConfig.color !== "string") {
    console.error(`FAIL [Tier 3] getLayerConfig().color is not a string: ${JSON.stringify(layerConfig.color)}`);
    passed = false;
  } else {
    console.log(`  ok   getLayerConfig() color=${layerConfig.color}`);
  }
} catch (err) {
  console.error(`FAIL [Tier 3] getLayerConfig() threw: ${err.message}`);
  passed = false;
}

// renderEntity() with a mock GeoEntity
const mockEntity = {
  id: "ci-smoke-001",
  pluginId: plugin.id,
  latitude: 37.7749,
  longitude: -122.4194,
  altitude: 0,
  timestamp: new Date(),
  label: "Smoke Test",
  properties: {},
};
try {
  const opts = plugin.renderEntity(mockEntity);
  if (!opts || typeof opts !== "object") {
    console.error(`FAIL [Tier 3] renderEntity() returned non-object: ${JSON.stringify(opts)}`);
    passed = false;
  } else if (typeof opts.type !== "string") {
    console.error(`FAIL [Tier 3] renderEntity().type is not a string (got ${JSON.stringify(opts.type)})`);
    passed = false;
  } else {
    console.log(`  ok   renderEntity() type=${opts.type}`);
  }
} catch (err) {
  console.error(`FAIL [Tier 3] renderEntity() threw: ${err.message}`);
  passed = false;
}

// mapWebsocketPayload() — optional but validated when present
if (typeof plugin.mapWebsocketPayload === "function") {
  // A flat GeoEntity[] is the simplest payload shape. Plugins that receive
  // object payloads from the seeder (e.g. { items: [...] }) must implement
  // this method to map to GeoEntity[]. We test with the flat-array case first.
  const mockPayload = [mockEntity];
  try {
    const result = plugin.mapWebsocketPayload(mockPayload, []);
    if (!Array.isArray(result)) {
      console.error(
        `FAIL [Tier 3] mapWebsocketPayload([entity]) returned non-array: ${JSON.stringify(typeof result)}`
      );
      passed = false;
    } else {
      console.log(`  ok   mapWebsocketPayload([1 entity]) -> ${result.length} entities`);
    }
  } catch (err) {
    console.error(`FAIL [Tier 3] mapWebsocketPayload() threw: ${err.message}`);
    passed = false;
  }
} else {
  console.log("  --   mapWebsocketPayload not implemented (flat GeoEntity[] assumed — OK)");
}

if (!passed) {
  console.error("FAIL [Tier 3] Method contract violations — see above");
  process.exit(1);
}
console.log("OK   [Tier 3] Method contracts validated");
console.log("PASS smoke test complete");
