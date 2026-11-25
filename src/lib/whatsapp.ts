import type { OrderItem } from '../types/immerso.ts';

export const BUSINESS_WHATSAPP_LOCAL = '03112537554';
export const BUSINESS_WHATSAPP_INTL = '+923112537554';
export const BUSINESS_WHATSAPP_NUMBER = '923112537554';

export interface WhatsAppOrderPayload {
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  city: string;
  postalCode?: string;
  items: OrderItem[];
  subtotalPkr: number;
  deliveryChargePkr: number;
  discountPkr: number;
  totalPkr: number;
  notes?: string;
}

export function generateOrderId(): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).slice(-2).toUpperCase();
  return `IMM-${randomPart}${timePart}`;
}

export function buildWhatsAppOrderMessage(payload: WhatsAppOrderPayload): string {
  const fullAddress = payload.postalCode
    ? `${payload.deliveryAddress}, ${payload.city} (${payload.postalCode})`
    : `${payload.deliveryAddress}, ${payload.city}`;

  const itemsText = payload.items
    .map(
      (item) =>
        `${item.name}\nSize: ${item.size}\nColor: ${item.color}\nQuantity: ${item.quantity}\nPrice: Rs. ${(item.pricePkr * item.quantity).toLocaleString('en-PK')}`
    )
    .join('\n\n');

  const discountLine =
    payload.discountPkr > 0
      ? `\n\nDiscount: -Rs. ${payload.discountPkr.toLocaleString('en-PK')}`
      : '';

  return `Hello IMMERSO! I would like to place an order.

Order ID: ${payload.orderId}

Customer Name: ${payload.customerName}

Customer Phone: ${payload.customerPhone}

Delivery Address: ${fullAddress}

Order Items:

${itemsText}

Subtotal: Rs. ${payload.subtotalPkr.toLocaleString('en-PK')}

Delivery Charges: Rs. ${payload.deliveryChargePkr.toLocaleString('en-PK')}${discountLine}

Total: Rs. ${payload.totalPkr.toLocaleString('en-PK')}

Additional Notes: ${payload.notes?.trim() || 'None'}

Please confirm my order. Thank you!`;
}

export function getWhatsAppOrderUrl(message: string): string {
  return `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function getWhatsAppSupportUrl(prefillText?: string): string {
  const msg = prefillText || 'Hello IMMERSO! I have a styling or order inquiry.';
  return `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}
