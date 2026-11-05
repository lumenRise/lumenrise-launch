interface DomainRequest {
  operation: string;
  parameters: Record<string, unknown>;
  deadline: number;
}

interface DomainReply {
  ok: boolean;
  result?: unknown;
  error?: string;
}

type DomainHandler = (request: DomainRequest) => Promise<unknown>;

type DomainErrorHandler = (error: unknown) => void;

interface DomainWorker {
  stop: () => Promise<void>;
}

export type { DomainRequest, DomainReply, DomainHandler, DomainErrorHandler, DomainWorker };
