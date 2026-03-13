import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import ranksRouter from "./ranks.js";
import squadsRouter from "./squads.js";
import rosterRouter from "./roster.js";
import activityRouter from "./activity.js";
import dashboardRouter from "./dashboard.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/ranks", ranksRouter);
router.use("/squads", squadsRouter);
router.use("/roster", rosterRouter);
router.use("/activity", activityRouter);
router.use("/dashboard", dashboardRouter);

export default router;
