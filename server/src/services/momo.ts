import { randomUUID } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://momoapi.momo.africa';
const cachedTokens: Partial<Record<'collection' | 'disbursement', { value: string; expiresAt: number }>> = {};

type MomoConfig = {
  baseUrl: string;
  userId: string;
  credentialToken: string;
  subscriptionKey: string;
  targetEnvironment: string;
};

function getConfig(product: 'collection' | 'disbursement' = 'collection'): MomoConfig {
  const baseUrl = (process.env.MTN_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const userId = process.env.MTN_USER_ID;
  const credentialToken = process.env.MTN_CREDENTIAL_TOKEN;
  const subscriptionKey = product === 'collection'
    ? process.env.MTN_COLLECTION_SUBSCRIPTION_KEY
    : process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY;
  const targetEnvironment = process.env.MTN_TARGET_ENVIRONMENT || 'sandbox';
  if (!userId || !credentialToken || !subscriptionKey) {
    throw new Error(`MTN MoMo ${product} credentials are incomplete.`);
  }
  return { baseUrl, userId, credentialToken, subscriptionKey, targetEnvironment };
}

async function accessToken(product: 'collection' | 'disbursement') {
  const config = getConfig(product);
  const cachedToken = cachedTokens[product];
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return { config, token: cachedToken.value };
  const response = await fetch(`${config.baseUrl}/${product}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.userId}:${config.credentialToken}`).toString('base64')}`,
      'Ocp-Apim-Subscription-Key': config.subscriptionKey,
      'X-Target-Environment': config.targetEnvironment,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; message?: string };
  if (!response.ok || !body.access_token) throw new Error(`MTN MoMo access token request failed (HTTP ${response.status}).`);
  cachedTokens[product] = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 300) * 1000 };
  return { config, token: body.access_token };
}

async function momoRequest<T>(product: 'collection' | 'disbursement', path: string, init: RequestInit = {}): Promise<{ response: Response; data: T | null }> {
  const { config, token } = await accessToken(product);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Ocp-Apim-Subscription-Key', config.subscriptionKey);
  headers.set('X-Target-Environment', config.targetEnvironment);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${config.baseUrl}/${product}/${path.replace(/^\//, '')}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => null) as T | null;
  if (!response.ok && response.status !== 202) {
    const reason = data && typeof data === 'object' && 'message' in data ? String((data as any).message) : '';
    throw new Error(`MTN MoMo request failed (HTTP ${response.status})${reason ? `: ${reason}` : ''}.`);
  }
  return { response, data };
}

export function momoConfigured(product: 'collection' | 'disbursement' = 'collection') {
  return Boolean(
    process.env.MTN_USER_ID && process.env.MTN_CREDENTIAL_TOKEN &&
    (product === 'collection' ? process.env.MTN_COLLECTION_SUBSCRIPTION_KEY : process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY)
  );
}

export function normalizeEswatiniMsisdn(value: unknown) {
  const digits = String(value ?? '').replace(/[\s()+-]/g, '');
  const normalized = digits.startsWith('268') ? digits : digits.startsWith('0') ? `268${digits.slice(1)}` : digits;
  if (!/^268[67]\d{7}$/.test(normalized)) throw new Error('Enter a valid Eswatini MTN mobile number, including its country code if needed.');
  return normalized;
}

export async function requestMomoPayment(input: { orderId: string; amount: string; phone: string; callbackUrl: string; referenceId?: string }) {
  const referenceId = input.referenceId || randomUUID();
  const { response } = await momoRequest('collection', 'v1_0/requesttopay', {
    method: 'POST',
    headers: {
      'X-Reference-Id': referenceId,
      'X-Callback-Url': input.callbackUrl,
    },
    body: JSON.stringify({
      amount: Number(input.amount).toFixed(2),
      currency: 'SZL',
      externalId: input.orderId,
      payer: { partyIdType: 'MSISDN', partyId: normalizeEswatiniMsisdn(input.phone) },
      payerMessage: 'StudentXchange order payment',
      payeeNote: `Order ${input.orderId.slice(0, 24)}`,
      ...(process.env.MTN_TRANSFER_TYPE ? { transferType: process.env.MTN_TRANSFER_TYPE } : {}),
    }),
  });
  if (response.status !== 202) throw new Error(`MTN MoMo did not accept the payment request (HTTP ${response.status}).`);
  return { referenceId };
}

export async function getMomoPaymentStatus(referenceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(referenceId)) throw new Error('Invalid MTN MoMo reference.');
  const { data } = await momoRequest('collection', `v1_0/requesttopay/${encodeURIComponent(referenceId)}`, { method: 'GET' });
  return data as { status?: string; externalId?: string; amount?: string; currency?: string; reason?: string } | null;
}

export async function requestMomoTransfer(input: { payoutId: string; amount: string; phone: string; callbackUrl: string; referenceId?: string }) {
  const referenceId = input.referenceId || randomUUID();
  const { response } = await momoRequest('disbursement', 'v1_0/transfer', {
    method: 'POST',
    headers: {
      'X-Reference-Id': referenceId,
      'X-Callback-Url': input.callbackUrl,
    },
    body: JSON.stringify({
      amount: Number(input.amount).toFixed(2),
      currency: 'SZL',
      externalId: input.payoutId,
      payee: { partyIdType: 'MSISDN', partyId: normalizeEswatiniMsisdn(input.phone) },
      payerMessage: 'StudentXchange seller payout',
      payeeNote: `Payout ${input.payoutId.slice(0, 24)}`,
      ...(process.env.MTN_TRANSFER_TYPE ? { transferType: process.env.MTN_TRANSFER_TYPE } : {}),
    }),
  });
  if (response.status !== 202) throw new Error(`MTN MoMo did not accept the payout (HTTP ${response.status}).`);
  return { referenceId };
}

export async function getMomoTransferStatus(referenceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(referenceId)) throw new Error('Invalid MTN MoMo transfer reference.');
  const { data } = await momoRequest('disbursement', `v1_0/transfer/${encodeURIComponent(referenceId)}`, { method: 'GET' });
  return data as { status?: string; externalId?: string; amount?: string; currency?: string; reason?: string } | null;
}
