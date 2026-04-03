import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("plan/:id", "routes/plan.$id.tsx"),
    route("api/plans", "routes/api.plans.ts"),
    route("api/plans/save", "routes/api.plans.save.ts"),
    route("api/plans/import", "routes/api.plans.import.ts"),
    route("api/plans/:id", "routes/api.plans.$id.ts"),
    route("api/ha/config", "routes/api.ha.config.ts"),
    route("api/ha/entities", "routes/api.ha.entities.ts"),
] satisfies RouteConfig;
