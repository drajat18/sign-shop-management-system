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
  customerComment?: string;
  customerResponseType?: "approved" | "changes_requested";
}

export type StorageProvider = "internal" | "dropbox" | "google_drive";

export interface ArtworkFile {
  id: string;
  fileName: string;
  storageProvider: StorageProvider;
}

export type StorageOAuthProvider = "dropbox" | "google_drive";

export interface StorageConnectionStatus {
  configured: boolean;
  connected: boolean;
  accountLabel?: string;
  connectedAt?: string;
}

export type PaymentOAuthProvider = "stripe" | "square" | "paypal";

export interface PaymentConnectionStatus {
  configured: boolean;
  connected: boolean;
  accountLabel?: string;
  connectedAt?: string;
}

export interface DummyPaymentConnectInfo {
  shopName: string;
  provider: PaymentOAuthProvider;
}

export interface DummyChargeInfo {
  customerName?: string;
  orderTotal: number;
  amount: number;
  paymentStatus: "unpaid" | "partial" | "paid";
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

export type PlatformRole = "owner" | "support" | "billing" | "onboarding";

export interface PlatformUser {
  id: string;
  name: string;
  role: PlatformRole;
}

export interface PlatformTeamMember {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  active: boolean;
}

export type PlanTier = "starter" | "growth" | "pro";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface ShopPlan {
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  employeeLimit: number | null;
  employeeCount: number;
  features: {
    reports: boolean;
    customer_portal: boolean;
    qr_tickets: boolean;
  };
  storage: {
    usedBytes: number;
    limitBytes: number;
    addonUnits: number;
    addonUnitGb: number;
  };
}

export interface CheckoutLink {
  url: string;
  mode: "stripe" | "dummy";
}

export interface FileGalleryItem {
  id: string;
  fileName: string;
  storageProvider: StorageProvider;
  fileSize: number;
  createdAt: string;
  uploadedBy?: { id: string; name: string } | null;
  order?: {
    id: string;
    description?: string;
    status: OrderStatus;
    customer?: { name: string } | null;
  } | null;
}

export interface FileGalleryResponse {
  files: FileGalleryItem[];
  usage: { usedBytes: number; limitBytes: number };
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  active: boolean;
  createdAt: string;
}

export interface PortalOrderItem {
  id: string;
  signType: string;
  size?: string;
  material?: string;
  description?: string;
  quantity: number;
  price: number;
  artworkFile?: { id: string; fileName: string } | null;
}

export interface PortalOrder {
  id: string;
  customerName?: string;
  status: OrderStatus;
  dueDate?: string;
  description?: string;
  total: number;
  paymentStatus: string;
  customerComment?: string;
  items: PortalOrderItem[];
}

export interface DummyCheckoutSession {
  shopName: string;
  kind: "plan" | "storage_addon";
  planTier?: PlanTier;
  priceUsd: number;
  completed: boolean;
}

export interface ReportsSummary {
  totalOrders: number;
  totalOrderValue: number;
  paidRevenue: number;
  ordersByStatus: Record<string, number>;
  avgTurnaroundDays: number | null;
  jobsByEmployee: { name: string; count: number }[];
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
      customerResponseType?: "approved" | "changes_requested";
    };
  };
}
