export type IdentityRequest = {
  identityKey: string;
  epoch: number;
  signal: AbortSignal;
  cancel: () => void;
  finish: () => void;
};

export class IdentityRequestLifecycle {
  private epoch = 0;
  private identityKey: string;
  private readonly controllers = new Set<AbortController>();

  constructor(identityKey: string) {
    this.identityKey = identityKey;
  }

  transition(identityKey: string) {
    if (identityKey === this.identityKey) return;
    this.abortAll();
    this.identityKey = identityKey;
    this.epoch += 1;
  }

  begin(identityKey: string): IdentityRequest {
    this.transition(identityKey);
    const controller = new AbortController();
    const requestEpoch = this.epoch;
    this.controllers.add(controller);
    return {
      identityKey,
      epoch: requestEpoch,
      signal: controller.signal,
      cancel: () => {
        controller.abort();
        this.controllers.delete(controller);
      },
      finish: () => this.controllers.delete(controller),
    };
  }

  isCurrent(request: IdentityRequest, renderedIdentityKey = this.identityKey) {
    return !request.signal.aborted
      && request.identityKey === this.identityKey
      && request.identityKey === renderedIdentityKey
      && request.epoch === this.epoch;
  }

  abortAll() {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  dispose() {
    this.abortAll();
    this.epoch += 1;
  }
}
