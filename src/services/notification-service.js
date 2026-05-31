const listeners = new Set();

export function notify(notification) {
  const payload = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type: "info",
    createdAt: new Date().toISOString(),
    read: false,
    ...notification
  };

  listeners.forEach(listener => listener(payload));
  return payload;
}

export function subscribeToNotifications(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
