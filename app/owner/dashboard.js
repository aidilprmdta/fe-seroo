import RoleShell from "../../src/components/RoleShell";

export default function OwnerDashboardScreen() {
  return (
    <RoleShell
      title="Dashboard Owner"
      role="Owner"
      readOnly
      emptyState="Ringkasan read-only belum tersedia dari API dashboard."
    />
  );
}
