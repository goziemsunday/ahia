interface OrderItemData {
  name: string;
  quantity: number;
  unitPrice: string;
  subTotal: string;
  imageUrl?: string;
}

interface ReceiptData {
  customerName: string;
  orderNumber: string;
  orderDate: string;
  paymentMethod: string;
  items: OrderItemData[];
  totalAmount: string;
}

export const buildOrderReceiptHtml = (data: ReceiptData): string => {
  const {
    customerName,
    orderNumber,
    orderDate,
    paymentMethod,
    items,
    totalAmount,
  } = data;

  const itemRows = items
    .map(
      (item) => `
      <tr>
        ${
          item.imageUrl
            ? `<td width="64" style="width:64px;padding:12px 16px 12px 0;vertical-align:top;border-bottom:1px solid #f0f0f0">
                 <img src="${item.imageUrl}" alt="${item.name}" width="64" height="64"
                      style="border-radius:6px;object-fit:cover;display:block" />
               </td>`
            : ""
        }
        <td width="100%" style="padding:12px 0;vertical-align:top;border-bottom:1px solid #f0f0f0">
          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#0a0a0a">${item.name}</p>
          <p style="margin:0;font-size:13px;color:#6b7280">Qty: ${item.quantity} &times; $${item.unitPrice}</p>
        </td>
        <td style="padding:12px 0 12px 16px;vertical-align:top;text-align:right;white-space:nowrap;border-bottom:1px solid #f0f0f0">
          <p style="margin:0;font-size:14px;font-weight:600;color:#0a0a0a">$${item.subTotal}</p>
        </td>
      </tr>`,
    )
    .join("");

  const capitalizedPayment =
    paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Order Receipt — ${orderNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f9fc;padding:32px 0">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden">

          <!-- Header -->
          <tr>
            <td style="background-color:#0a0a0a;padding:32px 40px;text-align:center">
              <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0 0 4px">Ahia</h1>
              <p style="color:#a1a1aa;font-size:14px;margin:0">Order Confirmation</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 40px">
              <p style="font-size:18px;font-weight:600;color:#0a0a0a;margin:0 0 8px">Hi ${customerName},</p>
              <p style="font-size:14px;line-height:24px;color:#525f7f;margin:0">
                Thank you for your purchase! Your order has been confirmed and payment received. Here's your receipt:
              </p>
            </td>
          </tr>

          <!-- Order Info -->
          <tr>
            <td style="padding:16px 40px;background-color:#fafafa">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%">
                <tr>
                  <td style="text-align:center;vertical-align:top;width:33%">
                    <p style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px">Order Number</p>
                    <p style="font-size:14px;font-weight:600;color:#0a0a0a;margin:0">${orderNumber}</p>
                  </td>
                  <td style="text-align:center;vertical-align:top;width:33%">
                    <p style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px">Date</p>
                    <p style="font-size:14px;font-weight:600;color:#0a0a0a;margin:0">${orderDate}</p>
                  </td>
                  <td style="text-align:center;vertical-align:top;width:33%">
                    <p style="font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px">Payment</p>
                    <p style="font-size:14px;font-weight:600;color:#0a0a0a;margin:0">${capitalizedPayment}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0" /></td></tr>

          <!-- Items -->
          <tr>
            <td style="padding:24px 40px">
              <h2 style="font-size:16px;font-weight:600;color:#0a0a0a;margin:0 0 16px">Items Ordered</h2>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%">
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0" /></td></tr>

          <!-- Total -->
          <tr>
            <td style="padding:20px 40px">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%">
                <tr>
                  <td width="100%" style="vertical-align:middle;width:100%">
                    <p style="font-size:16px;font-weight:600;color:#0a0a0a;margin:0">Total</p>
                  </td>
                  <td style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:16px">
                    <p style="font-size:24px;font-weight:700;color:#0a0a0a;margin:0">$${totalAmount}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0" /></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#fafafa;text-align:center">
              <p style="font-size:13px;color:#6b7280;margin:0 0 8px">If you have any questions about your order, simply reply to this email.</p>
              <p style="font-size:12px;color:#a1a1aa;margin:0">&copy; ${new Date().getFullYear()} Ahia. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
