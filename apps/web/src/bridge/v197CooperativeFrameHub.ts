export type V197CooperativeFrameClient = {
  boost: (durationMs?: number) => void;
  diagnostics: () => Record<string, unknown>;
  dispose: () => void;
};

export type V197CooperativeFrameOptions = {
  label: "galaxy" | "brain";
  callbackName?: string;
  minimumIdleBudgetMs?: number;
  starvationGuardMs?: number;
  interactionBoostMs?: number;
};

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type ClientRecord = {
  targetWindow: Window;
  label: "galaxy" | "brain";
  callbackName: string;
  minimumIdleBudgetMs: number;
  starvationGuardMs: number;
  interactionBoostMs: number;
  nativeRequestAnimationFrame: Window["requestAnimationFrame"];
  nativeCancelAnimationFrame: Window["cancelAnimationFrame"];
  pending: Map<number, FrameRequestCallback>;
  nextSyntheticHandle: number;
  boostUntil: number;
  boostOrder: number;
  deliveredFrames: number;
  yieldedFrames: number;
  disposed: boolean;
  publicClient: V197CooperativeFrameClient;
};

type Hub = {
  parentWindow: IdleWindow;
  clients: ClientRecord[];
  clientsByTarget: WeakMap<Window, ClientRecord>;
  parentFrameHandle: number | null;
  idleHandle: number | null;
  idleOwner: "requestIdleCallback" | "setTimeout" | null;
  roundRobinIndex: number;
  boostOrder: number;
};

const DEFAULT_MINIMUM_IDLE_BUDGET_MS = 5;
const DEFAULT_STARVATION_GUARD_MS = 96;
const DEFAULT_INTERACTION_BOOST_MS = 420;
const hubs = new WeakMap<Window, Hub>();

function pendingClients(hub: Hub): ClientRecord[] {
  return hub.clients.filter(client => !client.disposed && client.pending.size > 0);
}

function cancelIdleOwner(hub: Hub): void {
  if (hub.idleHandle === null) return;
  if (hub.idleOwner === "requestIdleCallback") {
    hub.parentWindow.cancelIdleCallback?.(hub.idleHandle);
  } else {
    hub.parentWindow.clearTimeout(hub.idleHandle);
  }
  hub.idleHandle = null;
  hub.idleOwner = null;
}

function cancelParentFrame(hub: Hub): void {
  if (hub.parentFrameHandle === null) return;
  hub.parentWindow.cancelAnimationFrame(hub.parentFrameHandle);
  hub.parentFrameHandle = null;
}

function chooseClient(hub: Hub): ClientRecord | null {
  const available = pendingClients(hub);
  if (available.length === 0) return null;

  const now = hub.parentWindow.performance.now();
  const boosted = available
    .filter(client => client.boostUntil > now)
    .sort((left, right) => right.boostOrder - left.boostOrder)[0];
  if (boosted) {
    const index = hub.clients.indexOf(boosted);
    hub.roundRobinIndex = index < 0 ? 0 : (index + 1) % hub.clients.length;
    return boosted;
  }

  for (let offset = 0; offset < hub.clients.length; offset += 1) {
    const index = (hub.roundRobinIndex + offset) % hub.clients.length;
    const client = hub.clients[index];
    if (!client.disposed && client.pending.size > 0) {
      hub.roundRobinIndex = (index + 1) % hub.clients.length;
      return client;
    }
  }
  return null;
}

function scheduleParentFrame(hub: Hub): void {
  if (
    hub.parentFrameHandle !== null
    || hub.idleHandle !== null
    || pendingClients(hub).length === 0
  ) return;

  hub.parentFrameHandle = hub.parentWindow.requestAnimationFrame(() => {
    hub.parentFrameHandle = null;
    scheduleIdleDelivery(hub);
  });
}

function deliverOneFrame(hub: Hub): void {
  const client = chooseClient(hub);
  if (!client) return;
  const entry = client.pending.entries().next().value as
    | [number, FrameRequestCallback]
    | undefined;
  if (!entry) return;
  const [handle, callback] = entry;
  client.pending.delete(handle);
  client.deliveredFrames += 1;

  try {
    callback(client.targetWindow.performance.now());
  } catch (error) {
    hub.parentWindow.setTimeout(() => {
      throw error;
    }, 0);
  }

  scheduleParentFrame(hub);
}

function scheduleIdleDelivery(hub: Hub): void {
  const available = pendingClients(hub);
  if (hub.idleHandle !== null || available.length === 0) return;

  const minimumBudget = Math.max(
    ...available.map(client => client.minimumIdleBudgetMs),
  );
  const starvationGuard = Math.min(
    ...available.map(client => client.starvationGuardMs),
  );
  const idleCallback = (deadline: IdleDeadlineLike): void => {
    hub.idleHandle = null;
    hub.idleOwner = null;
    if (!deadline.didTimeout && deadline.timeRemaining() < minimumBudget) {
      const next = chooseClient(hub);
      if (next) next.yieldedFrames += 1;
      scheduleParentFrame(hub);
      return;
    }
    deliverOneFrame(hub);
  };

  if (typeof hub.parentWindow.requestIdleCallback === "function") {
    hub.idleOwner = "requestIdleCallback";
    hub.idleHandle = hub.parentWindow.requestIdleCallback(idleCallback, {
      timeout: starvationGuard,
    });
    return;
  }

  hub.idleOwner = "setTimeout";
  hub.idleHandle = hub.parentWindow.setTimeout(() => {
    idleCallback({ didTimeout: true, timeRemaining: () => 0 });
  }, 0);
}

function removeClient(hub: Hub, client: ClientRecord): void {
  if (client.disposed) return;
  client.disposed = true;
  client.pending.clear();
  client.targetWindow.requestAnimationFrame = client.nativeRequestAnimationFrame;
  client.targetWindow.cancelAnimationFrame = client.nativeCancelAnimationFrame;
  hub.clientsByTarget.delete(client.targetWindow);
  const index = hub.clients.indexOf(client);
  if (index >= 0) hub.clients.splice(index, 1);
  if (hub.clients.length === 0) {
    cancelParentFrame(hub);
    cancelIdleOwner(hub);
    hubs.delete(hub.parentWindow);
    return;
  }
  hub.roundRobinIndex %= hub.clients.length;
  if (pendingClients(hub).length === 0) {
    cancelParentFrame(hub);
    cancelIdleOwner(hub);
  }
}

function createHub(parentWindow: IdleWindow): Hub {
  const hub: Hub = {
    parentWindow,
    clients: [],
    clientsByTarget: new WeakMap(),
    parentFrameHandle: null,
    idleHandle: null,
    idleOwner: null,
    roundRobinIndex: 0,
    boostOrder: 0,
  };
  hubs.set(parentWindow, hub);
  return hub;
}

/**
 * Moves only the named continuous artifact loop onto a shared parent owner.
 * One-shot resize and lifecycle callbacks remain native to the child document.
 */
export function installV197CooperativeFrameClient(
  parentWindow: Window,
  targetWindow: Window,
  options: V197CooperativeFrameOptions,
): V197CooperativeFrameClient {
  const idleParent = parentWindow as IdleWindow;
  const hub = hubs.get(parentWindow) ?? createHub(idleParent);
  const existing = hub.clientsByTarget.get(targetWindow);
  if (existing && !existing.disposed) return existing.publicClient;

  const nativeRequestAnimationFrame = targetWindow.requestAnimationFrame;
  const nativeCancelAnimationFrame = targetWindow.cancelAnimationFrame;
  const client = {} as ClientRecord;
  const publicClient: V197CooperativeFrameClient = Object.freeze({
    boost: (durationMs = client.interactionBoostMs): void => {
      if (client.disposed) return;
      client.boostUntil = Math.max(
        client.boostUntil,
        hub.parentWindow.performance.now() + Math.max(0, durationMs),
      );
      client.boostOrder = ++hub.boostOrder;
      scheduleParentFrame(hub);
    },
    diagnostics: (): Record<string, unknown> => ({
      owner: "shared-parent-raf",
      mode: "cooperative-idle",
      client: client.label,
      callbackName: client.callbackName,
      clients: hub.clients.length,
      pendingFrames: client.pending.size,
      deliveredFrames: client.deliveredFrames,
      yieldedFrames: client.yieldedFrames,
      boosted: client.boostUntil > hub.parentWindow.performance.now(),
      parentFrameScheduled: hub.parentFrameHandle !== null,
      idleScheduled: hub.idleHandle !== null,
    }),
    dispose: (): void => removeClient(hub, client),
  });

  Object.assign(client, {
    targetWindow,
    label: options.label,
    callbackName: options.callbackName ?? "frame",
    minimumIdleBudgetMs:
      options.minimumIdleBudgetMs ?? DEFAULT_MINIMUM_IDLE_BUDGET_MS,
    starvationGuardMs: options.starvationGuardMs ?? DEFAULT_STARVATION_GUARD_MS,
    interactionBoostMs: options.interactionBoostMs ?? DEFAULT_INTERACTION_BOOST_MS,
    nativeRequestAnimationFrame,
    nativeCancelAnimationFrame,
    pending: new Map<number, FrameRequestCallback>(),
    nextSyntheticHandle: -1,
    boostUntil: 0,
    boostOrder: 0,
    deliveredFrames: 0,
    yieldedFrames: 0,
    disposed: false,
    publicClient,
  } satisfies Partial<ClientRecord>);

  targetWindow.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    if (client.disposed || callback.name !== client.callbackName) {
      return client.nativeRequestAnimationFrame.call(targetWindow, callback);
    }
    const handle = client.nextSyntheticHandle--;
    client.pending.set(handle, callback);
    scheduleParentFrame(hub);
    return handle;
  }) as Window["requestAnimationFrame"];
  targetWindow.cancelAnimationFrame = ((handle: number): void => {
    if (client.pending.delete(handle)) {
      if (pendingClients(hub).length === 0) {
        cancelParentFrame(hub);
        cancelIdleOwner(hub);
      }
      return;
    }
    client.nativeCancelAnimationFrame.call(targetWindow, handle);
  }) as Window["cancelAnimationFrame"];

  hub.clients.push(client);
  hub.clientsByTarget.set(targetWindow, client);
  return publicClient;
}
