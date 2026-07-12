export type Role = "admin" | "manager" | "front_desk" | "production";

export type OrderStatus =
  | "new"
  | "design_approval"
  | "in_production"
  | "ready_for_pickup"
  | "completed";

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Order {
  id: string;
  customer: Customer;
  dueDate?: string;
  status: OrderStatus;
  total: number;
  paymentStatus: "unpaid" | "partial" | "paid";
}

export interface ProductionJob {
  id: string;
  status: "queued" | "in_progress" | "blocked" | "done";
  assignedTo?: string;
  notes?: string;
}
