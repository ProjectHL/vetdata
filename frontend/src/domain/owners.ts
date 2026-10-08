export type Owner = {
  /** RUT normalizado sin puntos: "16482335-0". */
  rut: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  altPhone?: string;
  address: string;
  sector: string;
  region: string;
  birthDate: string;
  registeredAt: string;
  preferredContact: "WhatsApp" | "Teléfono" | "Email";
  emergencyContact: { name: string; phone: string };
  shareConsent: boolean;
  /** Saldo pendiente en CLP. */
  balance: number;
  notes?: string;
};

export function ownerName(o: Owner) {
  return `${o.firstName} ${o.lastName}`;
}
