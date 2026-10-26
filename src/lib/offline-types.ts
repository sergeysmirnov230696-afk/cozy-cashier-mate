export type CreateOrderInputLike = {
  lines: { productId: string; qty: number; modifierIds: string[] }[];
  discountPercent: number;
  discountAmount: number;
  paymentMethod: "cash" | "card" | "mixed";
  cashReceived: number;
  cardAmount: number;
  orderType: string;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  bonusUsed: number;
};
