// Formatted single-document PDFs (one invoice, one receipt) meant to be
// printed or handed/emailed to a tenant — distinct from DataTable's own
// export, which dumps whatever rows are currently loaded in a table rather
// than laying out one record as a document.

import type { Invoice } from './useInvoices'
import type { Receipt } from './useReceipts'
import type { Payment } from '#shared/domain'

async function loadJsPdf() {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ])
  return { JsPDF, autoTable }
}

export function useDocumentPdf() {
  async function downloadInvoicePdf(invoice: Invoice, payments: Payment[] = []) {
    const { JsPDF, autoTable } = await loadJsPdf()
    const doc = new JsPDF()

    doc.setFontSize(18)
    doc.text('Invoice', 14, 20)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`Invoice #${invoice.id} · ${formatEnum(invoice.status)}`, 14, 27)
    doc.setTextColor(0)

    autoTable(doc, {
      startY: 34,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: { top: 1, bottom: 1, left: 0, right: 4 } },
      body: [
        ['Tenant', invoice.tenantName ?? '—'],
        ['Unit', [invoice.unitNumber, invoice.buildingName, invoice.propertyName].filter(Boolean).join(' · ') || '—'],
        ['Billing period', `${formatDate(invoice.billingPeriodStart)} – ${formatDate(invoice.billingPeriodEnd)}`],
        ['Due date', formatDate(invoice.dueDate)]
      ]
    })

    const afterInfo = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    autoTable(doc, {
      startY: afterInfo,
      head: [['', 'Amount']],
      body: [
        ['Rent', formatCurrency(invoice.rentAmount)],
        ['Late fee', formatCurrency(invoice.lateFeeAmount)],
        ['Total', formatCurrency(invoice.totalAmount)],
        ['Paid', formatCurrency(invoice.amountPaid)],
        ['Balance due', formatCurrency(invoice.balanceDue)]
      ],
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } }
    })

    if (payments.length > 0) {
      const afterAmounts = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      doc.setFontSize(11)
      doc.text('Payments', 14, afterAmounts)
      autoTable(doc, {
        startY: afterAmounts + 4,
        head: [['Date', 'Method', 'Reference', 'Amount']],
        body: payments.map((p) => [
          formatDate(p.paymentDate),
          formatEnum(p.method),
          p.referenceNumber ?? '—',
          formatCurrency(p.amount)
        ]),
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: 'right' } }
      })
    }

    if (invoice.notes) {
      const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`Notes: ${invoice.notes}`, 14, y, { maxWidth: 180 })
      doc.setTextColor(0)
    }

    doc.save(`invoice-${invoice.id}.pdf`)
  }

  async function downloadReceiptPdf(receipt: Receipt) {
    const { JsPDF, autoTable } = await loadJsPdf()
    const doc = new JsPDF()

    doc.setFontSize(18)
    doc.text('Receipt', 14, 20)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(receipt.receiptNumber, 14, 27)
    doc.setTextColor(0)

    autoTable(doc, {
      startY: 34,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: { top: 1.5, bottom: 1.5, left: 0, right: 4 } },
      body: [
        ['Payer', receipt.payerName],
        ['Source', formatEnum(receipt.sourceType)],
        ['Amount', formatCurrency(receipt.amount)],
        ['Payment date', formatDate(receipt.paymentDate)],
        ['Method', formatEnum(receipt.method)],
        ['Reference', receipt.referenceNumber ?? '—'],
        ['Issued', formatDate(receipt.issuedAt)]
      ]
    })

    doc.save(`receipt-${receipt.receiptNumber}.pdf`)
  }

  return { downloadInvoicePdf, downloadReceiptPdf }
}
