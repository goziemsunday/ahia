import { Resend } from "resend";

import { buildOrderReceiptHtml } from "@/emails/order-receipt";
import env from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);
const from = `Ahia <ahia@${env.RESEND_DOMAIN}>`;

type SendEmail = {
  to: string;
  token: string;
  name?: string;
  url?: string;
};

interface OrderItem {
  product: {
    name: string;
    images: { url: string; key: string }[];
  };
  quantity: number;
  unitPrice: string;
  subTotal: string;
}

interface OrderForReceipt {
  orderNumber: string;
  email: string;
  totalAmount: string;
  paymentMethod: string | null;
  createdAt: Date | string | null;
  orderItems: OrderItem[];
}

export const sendVerificationEmail = async ({
  to,
  token,
  name,
  url,
}: SendEmail) => {
  const verificationUrl = url ?? `${env.WEB_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from,
    to,
    subject: "Verify your email address",
    html: `
      <h1>Hello ${name || "there"}!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  });
};

export const sendResetPasswordEmail = async ({
  to,
  token,
  name,
  url,
}: SendEmail) => {
  const resetPasswordUrl =
    url ?? `${env.WEB_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from,
    to,
    subject: "Reset your password",
    html: `
      <h1>Hello ${name || "there"}!</h1>
      <p>Please reset your password by clicking the link below:</p>
      <a href="${resetPasswordUrl}">Reset Password</a>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  });
};

export const sendAccountCreatedEmail = async ({
  to,
  role,
  name,
  email,
  password,
}: Omit<SendEmail, "url" | "token"> & {
  role: string;
  email: string;
  password: string;
}) => {
  await resend.emails.send({
    from,
    to,
    subject: `Your ${role} account has been created`,
    html: `
      <h1>Hello ${name || "there"}!</h1>
      <p>Your ${role} account has been successfully created. You can now log in using the details below:</p>
      <ul>
        <li>Email: ${email}</li>
        <li>Password: ${password}</li>
      </ul>
      <p>For your security, please change your password after logging in.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  });
};

export const sendOrderReceiptEmail = async (
  order: OrderForReceipt,
  customerName?: string,
) => {
  const orderDate =
    order.createdAt instanceof Date
      ? order.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : order.createdAt
        ? new Date(order.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

  const items = order.orderItems.map((item) => ({
    name: item.product.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subTotal: item.subTotal,
    imageUrl: item.product.images[0]?.url,
  }));

  const html = buildOrderReceiptHtml({
    customerName: customerName ?? "Customer",
    orderNumber: order.orderNumber,
    orderDate,
    paymentMethod: order.paymentMethod ?? "card",
    items,
    totalAmount: order.totalAmount,
  });

  const { error } = await resend.emails.send({
    from,
    to: order.email,
    subject: `Order Confirmation — ${order.orderNumber}`,
    html,
  });

  if (error) {
    console.error(
      `[Email] Failed to send receipt for ${order.orderNumber}:`,
      error,
    );
    throw error;
  }

  console.log(
    `[Email] Receipt sent for ${order.orderNumber} to ${order.email}`,
  );
};
