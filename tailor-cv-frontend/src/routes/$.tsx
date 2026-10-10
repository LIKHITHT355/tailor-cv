import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/App";

// React Router handles the client route and redirects unknown paths to Workspace.
export const Route = createFileRoute("/$")({ component: App });
