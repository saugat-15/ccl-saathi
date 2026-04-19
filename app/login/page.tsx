import LoginView from "./LoginView";

type Tab = "signin" | "signup";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { tab?: string | string[] };
}) {
  const raw = searchParams.tab;
  const tabParam = Array.isArray(raw) ? raw[0] : raw;
  const defaultTab: Tab = tabParam === "signup" ? "signup" : "signin";
  return <LoginView defaultTab={defaultTab} />;
}
