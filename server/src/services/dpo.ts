const endpoint = process.env.DPO_API_URL || 'https://secure.3gdirectpay.com/API/v6/';

function xmlEscape(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return '';
  return match[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&').trim();
}

async function dpoRequest(xml: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/xml; charset=utf-8', accept: 'application/xml' },
    body: xml,
    signal: AbortSignal.timeout(20_000)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`DPO request failed with HTTP ${response.status}`);
  return body;
}

function requireDpoConfig() {
  const companyToken = process.env.DPO_COMPANY_TOKEN;
  const serviceType = process.env.DPO_SERVICE_TYPE;
  if (!companyToken || !serviceType) throw new Error('DPO_COMPANY_TOKEN and DPO_SERVICE_TYPE are required.');
  return { companyToken, serviceType };
}

export function dpoReturnUrl() {
  const origin = process.env.FRONTEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');
  return new URL('/api/payments/dpo/return', origin).toString();
}

export async function createDpoCheckout(input: { orderId: string; amount: string; currency: string; title: string; buyerName: string; buyerEmail: string }) {
  const { companyToken, serviceType } = requireDpoConfig();
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('DPO payment amount must be a positive number.');
  const companyRef = input.orderId;
  const callback = dpoReturnUrl();
  const [firstName = 'Student', ...last] = input.buyerName.trim().split(/\s+/);
  const serviceDate = new Date().toISOString().slice(0, 16).replace('T', ' ').replaceAll('-', '/');
  const xml = `<?xml version="1.0" encoding="utf-8"?><API3G><CompanyToken>${xmlEscape(companyToken)}</CompanyToken><Request>createToken</Request><Transaction><PaymentAmount>${amount.toFixed(2)}</PaymentAmount><PaymentCurrency>${xmlEscape(input.currency)}</PaymentCurrency><CompanyRef>${xmlEscape(companyRef)}</CompanyRef><CompanyRefUnique>1</CompanyRefUnique><OrderNumber>${xmlEscape(input.orderId.slice(0, 15))}</OrderNumber><RedirectURL>${xmlEscape(callback)}</RedirectURL><BackURL>${xmlEscape(callback)}</BackURL><PTL>24</PTL><customerFirstName>${xmlEscape(firstName)}</customerFirstName><customerLastName>${xmlEscape(last.join(' '))}</customerLastName><customerEmail>${xmlEscape(input.buyerEmail)}</customerEmail><TransactionSource>Website</TransactionSource></Transaction><Services><Service><ServiceType>${xmlEscape(serviceType)}</ServiceType><ServiceDescription>${xmlEscape(input.title.slice(0, 200))}</ServiceDescription><ServiceDate>${serviceDate}</ServiceDate><ServiceRef>${xmlEscape(input.orderId)}</ServiceRef></Service></Services></API3G>`;
  const response = await dpoRequest(xml);
  const result = xmlValue(response, 'Result');
  const token = xmlValue(response, 'TransToken');
  if (result !== '000' || !token) throw new Error(`DPO could not create checkout: ${xmlValue(response, 'ResultExplanation') || `result ${result || 'unknown'}`}`);
  const checkoutUrl = new URL('https://secure.3gdirectpay.com//payv2.php');
  checkoutUrl.searchParams.set('ID', token);
  return { token, companyRef, checkoutUrl: checkoutUrl.toString() };
}

export async function verifyDpoToken(token: string) {
  const { companyToken } = requireDpoConfig();
  const xml = `<?xml version="1.0" encoding="utf-8"?><API3G><CompanyToken>${xmlEscape(companyToken)}</CompanyToken><Request>verifyToken</Request><TransactionToken>${xmlEscape(token)}</TransactionToken></API3G>`;
  const response = await dpoRequest(xml);
  return {
    result: xmlValue(response, 'Result'),
    explanation: xmlValue(response, 'ResultExplanation'),
    amount: xmlValue(response, 'TransactionAmount'),
    currency: xmlValue(response, 'TransactionCurrency'),
    companyRef: xmlValue(response, 'CompanyRef'),
    reference: xmlValue(response, 'TransactionApproval') || xmlValue(response, 'TransactionRef')
  };
}

export async function refundDpoToken(input: { token: string; amount: string; details: string; reference: string }) {
  const { companyToken } = requireDpoConfig();
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('DPO refund amount must be positive.');
  const xml = `<?xml version="1.0" encoding="utf-8"?><API3G><CompanyToken>${xmlEscape(companyToken)}</CompanyToken><Request>refundToken</Request><TransactionToken>${xmlEscape(input.token)}</TransactionToken><refundAmount>${amount.toFixed(2)}</refundAmount><refundDetails>${xmlEscape(input.details.slice(0, 200))}</refundDetails><refundRef>${xmlEscape(input.reference.slice(0, 50))}</refundRef></API3G>`;
  const response = await dpoRequest(xml);
  const result = xmlValue(response, 'Result');
  if (result !== '000') throw new Error(`DPO refund failed: ${xmlValue(response, 'ResultExplanation') || `result ${result || 'unknown'}`}`);
  return { result, explanation: xmlValue(response, 'ResultExplanation') };
}
