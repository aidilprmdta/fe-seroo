import RoleShell from "../../src/components/RoleShell";

export default function ManagerDashboardScreen() {
  return (
    <RoleShell
      title="Dashboard Manager"
      role="Manager"
      emptyState="Ringkasan operasional belum tersedia dari API dashboard."
    />
  );
}
