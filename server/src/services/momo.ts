export function createMomoCheckout() {
  return {
    configured: Boolean(process.env.MOMO_SUBSCRIPTION_KEY && process.env.MOMO_API_USER && process.env.MOMO_API_KEY),
    message: 'MTN MoMo adapter is a stub. Configure and implement the provider API before accepting mobile money.'
  };
}
