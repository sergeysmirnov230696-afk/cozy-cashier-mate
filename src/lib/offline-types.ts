export type CreateOrderInputLike = {
  clientOrderId?: string;
  shiftId?: string;
  employeeId?: string;
  soldAt?: string;
  expectedTotal?: number;
  lines: { productId: string; qty: number; modifierIds: string[] }[];
  discountPercent: number;
  discountAmount: number;
  paymentMethod: "cash" | "card" | "mixed";
  cashReceived: number;
  cardAmount: number;
  orderType: "takeaway" | "dinein" | "delivery";
  customerName?: string;
  customerPhone?: string;
  note?: string;
  bonusUsed: number;
};
