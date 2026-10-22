// Storage and transport faults on a download report.
// A storage fault stops the walk. A transport fault is retried by auto download.

const STORAGE_CODES = new Set(['ENOSPC', 'EDQUOT', 'EROFS']);

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'FETCH_ERROR',
  'TIMEOUT',
  'TOO_MANY_REQUESTS',
  'SERVICE_UNAVAILABLE',
  'BAD_GATEWAY',
  'INTERNAL_SERVER_ERROR'
]);

const AUTH_CODES = new Set(['UNAUTHORIZED', 'FORBIDDEN']);

function codeOf (value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.code === 'string' && value.code) return value.code;
  const cause = value.cause;
  if (cause && typeof cause.code === 'string') return cause.code;
  return '';
}

export function isStorageFault (value) {
  return STORAGE_CODES.has(codeOf(value));
}

export function isAuthFault (value) {
  return AUTH_CODES.has(codeOf(value));
}

export function isNetworkFault (value) {
  if (value && value.retryable === true) return true;
  return NETWORK_CODES.has(codeOf(value));
}

// Sets report.fault and report.aborted when the value is a full disk.
// Returns true when the caller should stop the walk.
export function applyStorageFault (report, value) {
  if (!report || !isStorageFault(value)) return false;
  report.fault = 'storage';
  report.aborted = true;
  return true;
}

// Records a thrown page failure on the report. Storage wins over the network.
export function markThrownFault (report, error) {
  if (!report) return;
  if (applyStorageFault(report, error)) return;
  if (isAuthFault(error)) {
    report.fault = 'auth';
    return;
  }
  report.fault = 'network';
}
