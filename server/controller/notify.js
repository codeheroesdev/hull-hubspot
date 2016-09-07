import Promise from "bluebird";
import _ from "lodash";

import BatchSyncHandler from "../lib/batch-sync-handler";

export default class UserUpdateStrategy {
  userUpdateHandler(payload, { req }) {
    const message = payload.message;

    const { user, changes = {}, segments = [] } = message;

    if (_.get(changes, "user['traits_hubspot/fetched_at'][1]", false)) {
      return Promise.resolve();
    }

    user.segment_ids = _.concat(user.segment_ids || [], segments.map(s => s.id));

    if (!req.shipApp.hullAgent.shouldSyncUser(user)) {
      return Promise.resolve();
    }

    return BatchSyncHandler.getHandler({
      hull: req.hull,
      ship: req.hull.ship,
      options: {
        maxSize: 100,
        throttle: 30000
      }
    }).setCallback((users) => {
      return req.shipApp.queueAgent.create("sendUsersJob", { users });
    })
    .add(user);
  }

  shipUpdateHandler(payload, { req }) {
    const message = payload.message; // eslint-disable-line no-unused-vars
    return req.shipApp.hubspotAgent.syncHullGroup();
  }

  segmentUpdateHandler(payload, { req }) {
    const message = payload.message; // eslint-disable-line no-unused-vars
    return req.shipApp.hubspotAgent.syncHullGroup();
  }

  segmentDeleteHandler(payload, { req }) {
    const message = payload.message; // eslint-disable-line no-unused-vars
    return req.shipApp.hubspotAgent.syncHullGroup();
  }
}
