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
  unreadMessageCount?: number;
  customerResponseType?: "approved" | "message";
}

export interface OrderMessage {
  id: string;
  sender: "staff" | "customer";
  staffUser?: { id: string; name: string } | null;
  body: string;
  createdAt: string;
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

export interface DummyStorageConnectInfo {
  shopName: string;
  provider: StorageOAuthProvider;
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
  materialCostEstimate?: number;
  materialCostVendor?: string;
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
  materialCostEstimate?: number;
  materialCostVendor?: string;
}

export interface MaterialVendorQuote {
  vendor: string;
  costPerUnit: number;
}

export interface MaterialCostEstimate {
  material: string;
  costPerUnit: number;
  totalCost: number;
  bestVendor: string;
  quotes: MaterialVendorQuote[];
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

export interface NotificationLogEntry {
  id: string;
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
  trigger: string;
  createdAt: string;
}

export interface NotificationsResponse {
  emailConfigured: boolean;
  smsConfigured: boolean;
  logs: NotificationLogEntry[];
}

export interface MaterialStock {
  id: string;
  materialName: string;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
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
  items: PortalOrderItem[];
}

export interface DummyCheckoutSession {
  shopName: string;
  kind: "plan" | "storage_addon";
  planTier?: PlanTier;
  quantity: number;
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
      customerResponseType?: "approved" | "message";
    };
  };
}
