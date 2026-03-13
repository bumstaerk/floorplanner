import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("api/plans", "routes/api.plans.ts"),
    route("api/plans/save", "routes/api.plans.save.ts"),
    route("api/plans/:id", "routes/api.plans.$id.ts"),
] satisfies RouteConfig;
