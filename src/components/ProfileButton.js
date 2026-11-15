import { router } from "expo-router";
import { ROUTES } from "../auth/routePolicy";
import PrimaryButton from "./PrimaryButton";

export default function ProfileButton() {
  return (
    <PrimaryButton
      label="Profil"
      secondary
      onPress={() => router.push(ROUTES.profile)}
    />
  );
}
