import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import ranksRouter from "./ranks.js";
import squadsRouter from "./squads.js";
import rosterRouter from "./roster.js";
import activityRouter from "./activity.js";
import dashboardRouter from "./dashboard.js";
import settingsRouter from "./settings.js";
import orgRouter from "./org.js";
import userAccessRouter from "./user-access.js";
import userPermissionsRouter from "./user-permissions.js";
import clearancesRouter from "./clearances.js";
import messagesRouter from "./messages.js";
import updateRouter from "./update.js";
import channelsRouter from "./channels.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users/:id/access", userAccessRouter);
router.use("/users/:id/permissions", userPermissionsRouter);
router.use("/users", usersRouter);
router.use("/ranks", ranksRouter);
router.use("/squads", squadsRouter);
router.use("/roster", rosterRouter);
router.use("/activity", activityRouter);
router.use("/dashboard", dashboardRouter);
router.use("/settings", settingsRouter);
router.use("/clearances", clearancesRouter);
router.use("/messages", messagesRouter);
router.use("/channels", channelsRouter);
router.use("/update", updateRouter);
router.use("/", orgRouter);

export default router;
