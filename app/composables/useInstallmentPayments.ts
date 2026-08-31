// Wraps the backend's InstallmentController (/api/installments/{installmentId}/payments)
// — records SalePaymentType.INSTALLMENT payments against one installment row.

export function useInstallmentPayments() {
  const api = useApi()

  async function list(installmentId: number) {
    const res = await api<{ data: import('./useSaleReservations').SalePayment[] }>(
      `/api/installments/${installmentId}/payments`
    )
    return res.data
  }

  async function create(installmentId: number, payload: import('./useSaleReservations').CreateSalePaymentPayload) {
    const res = await api<{ data: import('./useSaleReservations').SalePayment }>(
      `/api/installments/${installmentId}/payments`,
      { method: 'POST', body: payload }
    )
    return res.data
  }

  return { list, create }
}
