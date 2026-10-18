export function createDpoCheckout() {
  return {
    configured: Boolean(process.env.DPO_COMPANY_TOKEN && process.env.DPO_SERVICE_TYPE),
    message: 'DPO Pay adapter is a stub. Configure and implement the provider API before accepting card payments.'
  };
}
