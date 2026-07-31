import type { Connection, Model } from "mongoose";
import { auditLogSchema, type AuditLog } from "./AuditLog.js";
import { customerSchema, type Customer } from "./Customer.js";
import { customerPortalTokenSchema, type CustomerPortalToken } from "./CustomerPortalToken.js";
import { fileRecordSchema, type FileRecord } from "./FileRecord.js";
import { orderSchema, type Order } from "./Order.js";
import { orderItemSchema, type OrderItem } from "./OrderItem.js";
import { passwordResetTokenSchema, type PasswordResetToken } from "./PasswordResetToken.js";
import { productionJobSchema, type ProductionJob } from "./ProductionJob.js";
import { statusLogSchema, type StatusLog } from "./StatusLog.js";
import { storageConnectionSchema, type StorageConnection } from "./StorageConnection.js";
import { userSchema, type User } from "./User.js";

export interface ShopModels {
  User: Model<User>;
  Customer: Model<Customer>;
  Order: Model<Order>;
  OrderItem: Model<OrderItem>;
  ProductionJob: Model<ProductionJob>;
  StatusLog: Model<StatusLog>;
  FileRecord: Model<FileRecord>;
  AuditLog: Model<AuditLog>;
  PasswordResetToken: Model<PasswordResetToken>;
  CustomerPortalToken: Model<CustomerPortalToken>;
  StorageConnection: Model<StorageConnection>;
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
  };
  registry.set(connection, models);
  return models;
}
