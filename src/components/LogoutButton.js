import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import PrimaryButton from "./PrimaryButton";

export default function LogoutButton() {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await logout();
    } finally {
      setLoading(false);
    }
  }

  return (
    <PrimaryButton
      label="Keluar"
      secondary
      loading={loading}
      onPress={handleLogout}
    />
  );
}
