export type HostMessageHandler = (message: unknown) => void | Promise<void>;

let activeHandler: HostMessageHandler | null = null;

export function setHostMessageHandler(handler: HostMessageHandler | null): void {
  activeHandler = handler;
}

export function dispatchHostMessage(message: unknown): boolean {
  if (!activeHandler) {
    return false;
  }

  void activeHandler(message);
  return true;
}
