export interface DnsLookupResult {
  address: string;
  family: number;
}

export type HttpMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS";

export interface RequestTransform {
  headers: Record<string, string>;
}

export interface AllowedUrl {
  url: string;
  transform?: RequestTransform[];
}

export type AllowedUrlEntry = string | AllowedUrl;

export interface NetworkConfig {
  allowedUrlPrefixes?: AllowedUrlEntry[];
  allowedMethods?: HttpMethod[];
  dangerouslyAllowFullInternetAccess?: boolean;
  maxRedirects?: number;
  timeoutMs?: number;
  maxResponseSize?: number;
  denyPrivateRanges?: boolean;
  _dnsResolve?: (hostname: string) => Promise<DnsLookupResult[]>;
}

export interface FetchResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Uint8Array;
  url: string;
}

export interface SecureFetchOptions {
  method?: string;
  headers?: Headers | Record<string, string>;
  body?: string;
  followRedirects?: boolean;
  timeoutMs?: number;
}

export type SecureFetch = (
  url: string,
  options?: SecureFetchOptions,
) => Promise<FetchResult>;

export class NetworkAccessDeniedError extends Error {
  constructor(url: string, reason = "URL not in allow-list") {
    super(`Network access denied: ${reason}: ${url}`);
    this.name = "NetworkAccessDeniedError";
  }
}

export class TooManyRedirectsError extends Error {
  constructor(maxRedirects: number) {
    super(`Too many redirects (max: ${maxRedirects})`);
    this.name = "TooManyRedirectsError";
  }
}

export class RedirectNotAllowedError extends Error {
  constructor(url: string) {
    super(`Redirect target not in allow-list: ${url}`);
    this.name = "RedirectNotAllowedError";
  }
}
