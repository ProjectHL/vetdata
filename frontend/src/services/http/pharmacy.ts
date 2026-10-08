import type { PharmacyService } from "../contracts";
import { NotImplementedError } from "./client";

export const pharmacy: PharmacyService = {
  /** GET /api/v1/pharmacy/medications */
  listMedications: async () => {
    throw new NotImplementedError("GET /api/v1/pharmacy/medications");
  },
  /** GET /api/v1/pharmacy/movements */
  listMovements: async () => {
    throw new NotImplementedError("GET /api/v1/pharmacy/movements");
  },
  /** POST /api/v1/pharmacy/movements */
  adjustStock: async () => {
    throw new NotImplementedError("POST /api/v1/pharmacy/movements");
  },
  /** GET /api/v1/pharmacy/suppliers */
  listSuppliers: async () => {
    throw new NotImplementedError("GET /api/v1/pharmacy/suppliers");
  },
  /** GET /api/v1/pharmacy/purchase-orders */
  listPurchaseOrders: async () => {
    throw new NotImplementedError("GET /api/v1/pharmacy/purchase-orders");
  },
  /** POST /api/v1/pharmacy/purchase-orders */
  createPurchaseOrder: async () => {
    throw new NotImplementedError("POST /api/v1/pharmacy/purchase-orders");
  },
  /** POST /api/v1/pharmacy/purchase-orders/:id/send */
  sendPurchaseOrder: async () => {
    throw new NotImplementedError("POST /api/v1/pharmacy/purchase-orders/:id/send");
  },
  /** POST /api/v1/pharmacy/purchase-orders/:id/receive */
  receivePurchaseOrder: async () => {
    throw new NotImplementedError("POST /api/v1/pharmacy/purchase-orders/:id/receive");
  },
};
