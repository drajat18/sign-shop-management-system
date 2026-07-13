import type { ProductionJob, OrderStatus } from "../types/index.js";

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  design_approval: "Design/Approval",
  in_production: "In Production",
  ready_for_pickup: "Ready for Pickup",
  completed: "Completed",
};

const JOB_STATUS_LABEL: Record<ProductionJob["status"], string> = {
  queued: "Queued",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-order-${status}`}>{ORDER_STATUS_LABEL[status]}</span>;
}

export function JobStatusBadge({ status }: { status: ProductionJob["status"] }) {
  return <span className={`badge badge-job-${status}`}>{JOB_STATUS_LABEL[status]}</span>;
}
