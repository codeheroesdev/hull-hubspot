import { Router } from "express";
import bodyParser from "body-parser";
import { Middleware } from "hull";
import cors from "cors";

import NotifHandler from "../lib/hull/notif-handler";
import ParseMessageMiddleware from "../lib/middleware/parse-message";
import AppMiddleware from "../lib/middleware/app";
import RequireConfiguration from "../util/middleware/require-configuration";
import responseMiddleware from "../util/middleware/response.js";
import * as actions from "../actions";


export default function (deps) {
  const router = Router();
  const {
    Hull,
    batchController,
    monitorController,
    fetchAllController,
    notifyController,
    syncController,
    hostSecret,
    queueAdapter,
    shipCache,
    instrumentationAgent
  } = deps;

  router
    .use("/notify", ParseMessageMiddleware)
    .use((req, res, next) => {
      if (req.query.ship || (req.hull && req.hull.token)) {
        return Middleware({ hostSecret, fetchShip: true, shipCache })(req, res, next);
      }
      return next();
    })
    .use(AppMiddleware({ queueAdapter, shipCache, instrumentationAgent }));

  router.post("/batch", RequireConfiguration, bodyParser.json(), batchController.handleBatchExtractAction);
  router.post("/fetchAll", RequireConfiguration, bodyParser.json(), fetchAllController.fetchAllAction);
  router.post("/sync", RequireConfiguration, bodyParser.json(), syncController.syncAction, responseMiddleware);

  router.post("/notify", NotifHandler(Hull, {
    hostSecret,
    groupTraits: false,
    handlers: {
      "segment:update": notifyController.segmentUpdateHandler,
      "segment:delete": notifyController.segmentDeleteHandler,
      "user:update": notifyController.userUpdateHandler,
      "ship:update": notifyController.shipUpdateHandler,
    },
    shipCache
  }));

  router.post("/monitor/checkToken", RequireConfiguration, bodyParser.json(), monitorController.checkTokenAction);

  router.get("/schema/contact_properties", cors(), RequireConfiguration, bodyParser.json(), actions.getContactProperties);

  router.post("/migrate", (req, res, next) => {
    req.shipApp.syncAgent.migrateSettings().then(next, next);
  }, responseMiddleware);

  return router;
}
