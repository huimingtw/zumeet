export const aqk = {
  reports: (status: string) => ["admin", "reports", status] as const,
  user: (id: string) => ["admin", "user", id] as const,
  actions: () => ["admin", "actions"] as const,
};
