// Datos semilla de la demo. Solo los leen services/mock, el estado inicial de los stores y el registry lib/server-state (fallbacks).
import {
  COURIERS,
  type Product,
  type ProductCategory,
  type RetailMovement,
  type RetailOrder,
  type RetailSupplier,
  type Sale,
  type SaleItem,
  type Shipment,
  type ShipmentStatus,
  type TargetSpecies,
} from "@/domain/retail";
import { addDays, TODAY } from "@/lib/format";

const p = (
  id: string, sku: string, name: string, brand: string, category: ProductCategory, species: TargetSpecies,
  price: number, cost: number, central: number, sala: number, reorderPoint: number, shelfMin: number, supplierId: string, bin: string
): Product => ({ id, sku, name, brand, category, species, price, cost, stock: { central, sala }, reorderPoint, shelfMin, supplierId, bin });

export const seedProducts: Product[] = [
  p("t01", "ALI-PP-ADM-15", "Pro Plan Adulto Raza Mediana 15 kg", "Purina Pro Plan", "Alimentos", "Perro", 64990, 41200, 18, 6, 12, 4, "rs1", "A-01"),
  p("t02", "ALI-RC-MIN-3", "Royal Canin Mini Adult 3 kg", "Royal Canin", "Alimentos", "Perro", 28990, 18100, 4, 2, 10, 4, "rs1", "A-02"),
  p("t03", "ALI-RC-REN-2", "Royal Canin Renal gato 2 kg", "Royal Canin", "Alimentos", "Gato", 32990, 21300, 6, 3, 6, 2, "rs1", "A-02"),
  p("t04", "ALI-HL-KD-4", "Hill's k/d Felino 4 kg", "Hill's", "Alimentos", "Gato", 49990, 32500, 2, 1, 5, 2, "rs1", "A-03"),
  p("t05", "ALI-BR-CAC-1", "Brit Care Cachorro 1 kg", "Brit", "Alimentos", "Perro", 9990, 5900, 22, 8, 10, 5, "rs2", "A-04"),
  p("t06", "ALI-VL-CON-2", "Versele-Laga Cuni Adulto 2 kg", "Versele-Laga", "Alimentos", "Conejo", 11990, 7100, 7, 3, 5, 2, "rs2", "A-05"),
  p("t07", "ALI-VL-PER-1", "Mezcla semillas periquitos 1 kg", "Versele-Laga", "Alimentos", "Ave", 5990, 3300, 10, 4, 6, 3, "rs2", "A-05"),
  p("t08", "ALI-LAT-GAT", "Lata Whiskas pollo 85 g", "Whiskas", "Alimentos", "Gato", 990, 520, 96, 30, 60, 24, "rs2", "A-06"),
  p("t09", "SNK-DEN-M", "Dentastix mediano x7", "Pedigree", "Snacks", "Perro", 4990, 2800, 30, 12, 20, 10, "rs2", "B-01"),
  p("t10", "SNK-CHU-4", "Churu atún x4", "Inaba", "Snacks", "Gato", 3990, 2100, 8, 5, 20, 10, "rs2", "B-01"),
  p("t11", "SNK-HUE-NAT", "Hueso natural de vacuno", "PetNatural", "Snacks", "Perro", 3490, 1700, 25, 10, 15, 6, "rs2", "B-02"),
  p("t12", "ACC-COR-REF", "Correa reflectante 1,5 m", "Kurgo", "Accesorios", "Perro", 12990, 6400, 14, 5, 8, 3, "rs3", "C-01"),
  p("t13", "ACC-ARN-M", "Arnés acolchado talla M", "Ruffwear", "Accesorios", "Perro", 24990, 13200, 6, 2, 6, 2, "rs3", "C-01"),
  p("t14", "ACC-COM-INOX", "Comedero acero inoxidable", "PetCo Chile", "Accesorios", "Todas", 6990, 3100, 20, 8, 10, 4, "rs3", "C-02"),
  p("t15", "ACC-PLA-ID", "Placa de identificación grabada", "PetCo Chile", "Accesorios", "Todas", 5990, 1800, 40, 15, 20, 8, "rs3", "C-02"),
  p("t16", "ACC-ARE-SIL", "Arena sílica 3,8 L", "Catit", "Higiene", "Gato", 8990, 4700, 3, 2, 12, 5, "rs3", "D-01"),
  p("t17", "HIG-SHA-AV", "Shampoo avena piel sensible", "Petys", "Higiene", "Todas", 7990, 3900, 16, 6, 8, 3, "rs3", "D-02"),
  p("t18", "HIG-BOL-100", "Bolsas sanitarias x100", "PetCo Chile", "Higiene", "Perro", 3990, 1600, 45, 20, 25, 10, "rs3", "D-02"),
  p("t19", "HIG-PAD-30", "Pañales de entrenamiento x30", "Petys", "Higiene", "Perro", 11990, 6300, 9, 4, 8, 3, "rs3", "D-03"),
  p("t20", "ROP-POL-S", "Polerón polar talla S", "Pet Style", "Ropa", "Perro", 14990, 6900, 12, 4, 6, 3, "rs4", "E-01"),
  p("t21", "ROP-IMP-M", "Impermeable talla M", "Pet Style", "Ropa", "Perro", 17990, 8200, 8, 3, 6, 2, "rs4", "E-01"),
  p("t22", "ROP-COLL-POST", "Collar isabelino / body post-operatorio", "Pet Style", "Ropa", "Todas", 9990, 4300, 10, 4, 6, 3, "rs4", "E-02"),
  p("t23", "JUG-KONG-M", "Kong Classic M", "Kong", "Juguetes", "Perro", 13990, 7400, 11, 4, 8, 3, "rs5", "F-01"),
  p("t24", "JUG-RAT-3", "Ratones con catnip x3", "Kong", "Juguetes", "Gato", 4990, 2200, 18, 7, 10, 4, "rs5", "F-01"),
  p("t25", "JUG-PEL-TEN", "Pelotas de tenis x3", "Chuckit!", "Juguetes", "Perro", 6990, 3300, 2, 1, 10, 4, "rs5", "F-02"),
  p("t26", "JUG-RAS-TOR", "Rascador torre 90 cm", "Catit", "Juguetes", "Gato", 39990, 21500, 3, 1, 3, 1, "rs5", "F-03"),
  p("t27", "CAM-ORT-M", "Cama ortopédica M", "Pet Style", "Camas y transporte", "Perro", 34990, 18900, 4, 1, 4, 1, "rs4", "G-01"),
  p("t28", "CAM-TRA-GAT", "Transportadora gato/perro pequeño", "Ferplast", "Camas y transporte", "Todas", 29990, 15800, 5, 2, 4, 2, "rs3", "G-02"),
];

export const retailSuppliers: RetailSupplier[] = [
  { id: "rs1", name: "Nutrición Animal Distribuidora", rut: "76.881.402-3", contact: "Javiera Cortés", phone: "+56 2 2710 4400", email: "pedidos@nutrianimal.cl", categories: ["Alimentos"], leadTimeDays: 3, minOrder: 300000, paymentTerms: "30 días" },
  { id: "rs2", name: "PetFood Mayorista", rut: "77.120.553-8", contact: "Óscar Riquelme", phone: "+56 2 2585 1200", email: "ventas@petfoodmayorista.cl", categories: ["Alimentos", "Snacks"], leadTimeDays: 2, minOrder: 150000, paymentTerms: "Contado" },
  { id: "rs3", name: "Accesorios Pet Chile", rut: "76.455.910-K", contact: "Natalia Pizarro", phone: "+56 2 2944 7300", email: "comercial@accpetchile.cl", categories: ["Accesorios", "Higiene", "Camas y transporte"], leadTimeDays: 5, minOrder: 100000, paymentTerms: "45 días" },
  { id: "rs4", name: "Pet Style Textil", rut: "77.903.118-5", contact: "Valeria Ortúzar", phone: "+56 9 6120 4471", email: "hola@petstyle.cl", categories: ["Ropa", "Camas y transporte"], leadTimeDays: 7, minOrder: 120000, paymentTerms: "30 días" },
  { id: "rs5", name: "Juguetes Kong Importador", rut: "76.330.287-1", contact: "Felipe Arancibia", phone: "+56 2 2366 8810", email: "ventas@kongchile.cl", categories: ["Juguetes"], leadTimeDays: 10, minOrder: 200000, paymentTerms: "60 días" },
];

export const seedRetailOrders: RetailOrder[] = [
  { id: "ro1", number: 501, supplierId: "rs1", date: "2026-09-26", expected: "2026-09-29", items: [{ productId: "t01", qty: 10, unitCost: 41200 }, { productId: "t03", qty: 6, unitCost: 21300 }], status: "Recibida", receivedAt: "2026-09-29" },
  { id: "ro2", number: 507, supplierId: "rs4", date: "2026-10-02", expected: "2026-10-09", items: [{ productId: "t20", qty: 12, unitCost: 6900 }, { productId: "t21", qty: 8, unitCost: 8200 }], status: "Enviada" },
];

export const seedRetailMovements: RetailMovement[] = [
  { id: "rm01", date: "2026-09-29", productId: "t01", type: "Entrada", reason: "Compra", location: "central", qty: 10, ref: "OC 501", user: "Marcela Toro" },
  { id: "rm02", date: "2026-09-29", productId: "t03", type: "Entrada", reason: "Compra", location: "central", qty: 6, ref: "OC 501", user: "Marcela Toro" },
  { id: "rm03", date: "2026-09-30", productId: "t01", type: "Transferencia", reason: "Reposición sala", location: "sala", from: "central", qty: 4, user: "Marcela Toro" },
  { id: "rm04", date: "2026-10-02", productId: "t08", type: "Transferencia", reason: "Reposición sala", location: "sala", from: "central", qty: 24, user: "Marcela Toro" },
  { id: "rm05", date: "2026-10-03", productId: "t25", type: "Ajuste", reason: "Merma", location: "sala", qty: -2, ref: "Producto dañado", user: "Constanza Arias" },
  { id: "rm06", date: "2026-10-05", productId: "t16", type: "Ajuste", reason: "Conteo", location: "central", qty: -1, ref: "Inventario cíclico", user: "Marcela Toro" },
];

// ---- Ventas semilla: generadas de forma determinista para los últimos 14 días ----

const SELLERS = ["Constanza Arias", "Bastián Lillo", "Marcela Toro"];
const CUSTOMERS = ["16482335-0", "15620948-1", "18556013-9", "13907452-1", "14290186-2", "12764509-4", undefined, undefined];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function buildSeedSales(): Sale[] {
  const rand = rng(42);
  const sales: Sale[] = [];
  let number = 30120;
  for (let d = 13; d >= 0; d--) {
    const date = addDays(TODAY, -d);
    const count = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < count; k++) {
      const lines = 1 + Math.floor(rand() * 3);
      const items: SaleItem[] = [];
      for (let l = 0; l < lines; l++) {
        const product = seedProducts[Math.floor(rand() * seedProducts.length)];
        if (items.some((i) => i.productId === product.id)) continue;
        items.push({ productId: product.id, qty: 1 + Math.floor(rand() * 2), unitPrice: product.price });
      }
      const ownerRut = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)];
      const web = ownerRut !== undefined && rand() < 0.3;
      const fee = web ? 3990 : 0;
      sales.push({
        id: `s${number}`,
        number: number++,
        date,
        time: `${String(10 + Math.floor(rand() * 9)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}`,
        items,
        ownerRut,
        payment: (["Débito", "Crédito", "Efectivo", "Transferencia"] as const)[Math.floor(rand() * 4)],
        deliveryFee: fee,
        total: items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + fee,
        seller: web ? "Tienda web" : SELLERS[Math.floor(rand() * SELLERS.length)],
        channel: web ? "Web" : "Mesón",
      });
    }
  }
  return sales;
}

export const seedSales = buildSeedSales();

/** Despachos para las ventas web: las antiguas entregadas, las recientes en curso. */
export function buildSeedShipments(
  sales: Sale[],
  addressOf: (rut: string) => { address: string; sector: string }
): Shipment[] {
  return sales
    .filter((s) => s.channel === "Web" && s.ownerRut)
    .map((s, i) => {
      const age = Math.round((Date.parse(TODAY) - Date.parse(s.date)) / 86_400_000);
      const status: ShipmentStatus = age > 2 ? "Entregado" : age === 2 ? "En ruta" : age === 1 ? "Preparado" : "Por preparar";
      const { address, sector } = addressOf(s.ownerRut!);
      return {
        id: `sh-${s.id}`,
        saleId: s.id,
        ownerRut: s.ownerRut!,
        address,
        sector,
        courier: COURIERS[i % COURIERS.length],
        scheduledFor: addDays(s.date, 1),
        status,
      };
    });
}
