export type SecurityViolationType =
  | "blocked-global"
  | "dynamic-code"
  | "process-access"
  | "filesystem-access"
  | "network-access"
  | "unknown";

export interface SecurityViolation {
  type: SecurityViolationType;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface DefenseInDepthConfig {
  enabled?: boolean;
  auditMode?: boolean;
  onViolation?: (violation: SecurityViolation) => void;
}

export interface DefenseInDepthStats {
  violations: number;
}

export interface DefenseInDepthHandle {
  run<T>(fn: () => T | Promise<T>): T | Promise<T>;
  deactivate(): void;
}

export class SecurityViolationError extends Error {
  constructor(message: string, readonly violation?: SecurityViolation) {
    super(message);
    this.name = "SecurityViolationError";
  }
}

export class SecurityViolationLogger {
  readonly violations: SecurityViolation[] = [];

  log(violation: SecurityViolation): void {
    this.violations.push(violation);
  }
}

export class DefenseInDepthBox {
  static getInstance(_config?: DefenseInDepthConfig | boolean): DefenseInDepthBox {
    return new DefenseInDepthBox();
  }

  static isInSandboxedContext(): boolean {
    return false;
  }

  static runTrustedAsync<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  isEnabled(): boolean {
    return false;
  }

  activate(): DefenseInDepthHandle {
    return {
      run: (fn) => fn(),
      deactivate: () => {},
    };
  }

  getStats(): DefenseInDepthStats {
    return { violations: 0 };
  }
}

export function createConsoleViolationCallback(): (violation: SecurityViolation) => void {
  return (violation) => {
    console.warn("moon-bash security violation", violation);
  };
}
