import { createFileRoute } from "@tanstack/react-router";
import { LingguangApp } from "@/components/lingguang-app";

export const Route = createFileRoute("/")({
  component: LingguangApp,
});
