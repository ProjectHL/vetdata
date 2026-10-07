import type { RetailService } from "../contracts";
import { NotImplementedError } from "./client";

export const retail: RetailService = {
  /** GET /api/v1/retail/products */
  listProducts: async () => {
    throw new NotImplementedError("GET /api/v1/retail/products");
  },
  /** GET /api/v1/retail/suppliers */
  listSuppliers: async () => {
    throw new NotImplementedError("GET /api/v1/retail/suppliers");
  },
  /** GET /api/v1/retail/sales */
  listSales: async () => {
    throw new NotImplementedError("GET /api/v1/retail/sales");
  },
  /** POST /api/v1/retail/sales */
  checkout: async () => {
    throw new NotImplementedError("POST /api/v1/retail/sales");
  },
  /** GET /api/v1/retail/movements */
  listMovements: async () => {
    throw new NotImplementedError("GET /api/v1/retail/movements");
  },
  /** POST /api/v1/retail/transfers */
  transferToSala: async () => {
    throw new NotImplementedError("POST /api/v1/retail/transfers");
  },
  /** POST /api/v1/retail/adjustments */
  adjust: async () => {
    throw new NotImplementedError("POST /api/v1/retail/adjustments");
  },
  /** GET /api/v1/retail/orders */
  listOrders: async () => {
    throw new NotImplementedError("GET /api/v1/retail/orders");
  },
  /** POST /api/v1/retail/orders */
  createOrder: async () => {
    throw new NotImplementedError("POST /api/v1/retail/orders");
  },
  /** POST /api/v1/retail/orders/:id/send */
  sendOrder: async () => {
    throw new NotImplementedError("POST /api/v1/retail/orders/:id/send");
  },
  /** POST /api/v1/retail/orders/:id/receive */
  receiveOrder: async () => {
    throw new NotImplementedError("POST /api/v1/retail/orders/:id/receive");
  },
  /** GET /api/v1/retail/shipments */
  listShipments: async () => {
    throw new NotImplementedError("GET /api/v1/retail/shipments");
  },
  /** POST /api/v1/retail/shipments/:id/advance */
  advanceShipment: async () => {
    throw new NotImplementedError("POST /api/v1/retail/shipments/:id/advance");
  },
};
