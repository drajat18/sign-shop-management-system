export type Role = "admin" | "manager" | "front_desk" | "production";

export type OrderStatus =
  | "new"
  | "design_approval"
  | "in_production"
  | "ready_for_pickup"
  | "completed";

export type JobStatus = "queued" | "in_progress" | "blocked" | "done";

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
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
  description?: string;
  status: OrderStatus;
  total: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  itemsCount: number;
}

export interface ArtworkFile {
  id: string;
  fileName: string;
  storageProvider: "internal" | "dropbox";
}

export interface OrderItem {
  id: string;
  signType: string;
  size?: string;
  material?: string;
  description?: string;
  quantity: number;
  price: number;
  artworkFile?: ArtworkFile | null;
  job?: {
    id: string;
    status: JobStatus;
    assignedTo?: { id: string; name: string } | null;
  } | null;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

export interface NewOrderItemInput {
  signType: string;
  size?: string;
  material?: string;
  description?: string;
  quantity: number;
  price: number;
  file?: File | null;
}

export interface ProductionJob {
  id: string;
  status: JobStatus;
  assignedTo?: { id: string; name: string } | null;
  notes?: string;
  orderItem: {
    id: string;
    signType: string;
    size?: string;
    material?: string;
    quantity: number;
    order: {
      id: string;
      dueDate?: string;
      customer: Customer;
    };
  };
}
