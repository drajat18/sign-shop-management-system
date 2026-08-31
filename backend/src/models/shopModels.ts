import type { Connection, Model } from "mongoose";
import { auditLogSchema, type AuditLog } from "./AuditLog.js";
import { customerSchema, type Customer } from "./Customer.js";
import { customerPortalTokenSchema, type CustomerPortalToken } from "./CustomerPortalToken.js";
import { fileRecordSchema, type FileRecord } from "./FileRecord.js";
import { orderSchema, type Order } from "./Order.js";
import { orderItemSchema, type OrderItem } from "./OrderItem.js";
import { orderMessageSchema, type OrderMessage } from "./OrderMessage.js";
import { notificationLogSchema, type NotificationLog } from "./NotificationLog.js";
import { materialStockSchema, type MaterialStock } from "./MaterialStock.js";
import { passwordResetTokenSchema, type PasswordResetToken } from "./PasswordResetToken.js";
import { paymentConnectionSchema, type PaymentConnection } from "./PaymentConnection.js";
import { paymentSchema, type Payment } from "./Payment.js";
import { productionJobSchema, type ProductionJob } from "./ProductionJob.js";
import { statusLogSchema, type StatusLog } from "./StatusLog.js";
import { storageConnectionSchema, type StorageConnection } from "./StorageConnection.js";
import { userSchema, type User } from "./User.js";

export interface ShopModels {
  User: Model<User>;
  Customer: Model<Customer>;
  Order: Model<Order>;
  OrderItem: Model<OrderItem>;
  OrderMessage: Model<OrderMessage>;
  ProductionJob: Model<ProductionJob>;
  StatusLog: Model<StatusLog>;
  FileRecord: Model<FileRecord>;
  AuditLog: Model<AuditLog>;
  PasswordResetToken: Model<PasswordResetToken>;
  CustomerPortalToken: Model<CustomerPortalToken>;
  StorageConnection: Model<StorageConnection>;
  PaymentConnection: Model<PaymentConnection>;
  Payment: Model<Payment>;
  NotificationLog: Model<NotificationLog>;
  MaterialStock: Model<MaterialStock>;
}

const registry = new WeakMap<Connection, ShopModels>();

// Mongoose throws if you call connection.model(name, schema) twice on the
// same connection, so every shop connection gets its models bound and
// cached exactly once here rather than at each call site.
export function getShopModels(connection: Connection): ShopModels {
  const cached = registry.get(connection);
  if (cached) return cached;

  const models: ShopModels = {
    User: connection.model<User>("User", userSchema),
    Customer: connection.model<Customer>("Customer", customerSchema),
    Order: connection.model<Order>("Order", orderSchema),
    OrderItem: connection.model<OrderItem>("OrderItem", orderItemSchema),
    OrderMessage: connection.model<OrderMessage>("OrderMessage", orderMessageSchema),
    ProductionJob: connection.model<ProductionJob>("ProductionJob", productionJobSchema),
    StatusLog: connection.model<StatusLog>("StatusLog", statusLogSchema),
    FileRecord: connection.model<FileRecord>("FileRecord", fileRecordSchema),
    AuditLog: connection.model<AuditLog>("AuditLog", auditLogSchema),
    PasswordResetToken: connection.model<PasswordResetToken>(
      "PasswordResetToken",
      passwordResetTokenSchema
    ),
    CustomerPortalToken: connection.model<CustomerPortalToken>(
      "CustomerPortalToken",
      customerPortalTokenSchema
    ),
    StorageConnection: connection.model<StorageConnection>(
      "StorageConnection",
      storageConnectionSchema
    ),
    PaymentConnection: connection.model<PaymentConnection>(
      "PaymentConnection",
      paymentConnectionSchema
    ),
    Payment: connection.model<Payment>("Payment", paymentSchema),
    NotificationLog: connection.model<NotificationLog>("NotificationLog", notificationLogSchema),
    MaterialStock: connection.model<MaterialStock>("MaterialStock", materialStockSchema),
  };
  registry.set(connection, models);
  return models;
}
