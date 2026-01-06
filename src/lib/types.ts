

import type { Timestamp } from "firebase/firestore";

export type Product = {
  id?: string;
  name: string;
  category: string;
  sku: string;
  costPrice: number;
  retailPrice?: number; // Made optional as it will be calculated dynamically
  promoPrice?: number;
  stockLevel: number;
  reservedStock: number;
  damagedStock: number;
  lowStockThreshold: number;
  compatibleModels?: string[];
};

export type ReservedPart = {
  productId: string;
  productName: string;
  quantity: number;
}

export type RepairStatus = 'Pendiente' | 'Diagnóstico' | 'En Progreso' | 'Esperando Piezas' | 'Listo para Recoger' | 'Completado';

export type RepairJob = {
  id?: string;
  customerName: string;
  customerPhone: string;
  customerID?: string;
  customerAddress?: string;
  deviceMake: string;
  deviceModel: string;
  deviceImei?: string;
  devicePatternOrPassword?: string;
  reportedIssue: string;
  initialConditionsChecklist?: string[];
  estimatedCost: number;
  amountPaid: number;
  isPaid: boolean;
  status: RepairStatus;
  notes?: string;
  createdAt: string;
  reservedParts: ReservedPart[];
  completedAt?: string;
  warrantyEndDate?: string;
};

export type CartItem = {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  isRepair?: boolean;
  isPromo?: boolean;
};

export type HeldSale = {
  id: string;
  name: string;
  createdAt: string;
  items: CartItem[];
};

export type PaymentMethod = 'Efectivo USD' | 'Efectivo Bs' | 'Tarjeta' | 'Pago Móvil';

export type Payment = {
  method: PaymentMethod;
  amount: number;
}

export type Sale = {
  id?: string;
  items: CartItem[];
  repairJobId?: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: string;
  transactionDate: string;
  payments: Payment[];
  status: 'completed' | 'refunded';
  refundedAt?: string;
  refundReason?: string;
  reconciliationId?: string; // ID linking to the daily reconciliation
};

export type ReconciliationPaymentMethodSummary = {
  expected: number;
  counted: number;
  difference: number;
};

export type DailyReconciliation = {
  id: string;
  date: string; // YYYY-MM-DD format
  totalSales: number;
  totalTransactions: number;
  closedAt: string; // ISO 8601 string
  paymentMethods: {
    [key in PaymentMethod]?: ReconciliationPaymentMethodSummary;
  };
  totalExpected: number;
  totalCounted: number;
  totalDifference: number;
};


export type Currency = 'USD' | 'Bs';

export type AppSettings = {
    currency: Currency;
    bcvRate: number; // Tasa Oficial
    parallelRate: number; // Tasa de Reposicion
    profitMargin: number; // Margen de Ganancia
    lastUpdated?: string; // ISO 8601 date string
};
