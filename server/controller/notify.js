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

    user.segment_ids = _.uniq(_.concat(user.segment_ids || [], segments.map(s => s.id)));

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
    return req.shipApp.hubspotAgent.syncHullGroup()
      .catch((err) => req.hull.client.logger.error("Error in creating segments property", err));
  }

  segmentUpdateHandler(payload, { req }) {
    const segment = payload.message;
    return req.shipApp.hubspotAgent.syncHullGroup()
      .then(() => {
        return req.shipApp.hullAgent.requestExtract({ segment });
      });
  }

  segmentDeleteHandler(payload, { req }) {
    // TODO: if the segment would have `query` param we could trigger an extract
    // for deleted segment
    const segment = payload.message; // eslint-disable-line no-unused-vars
    return req.shipApp.hubspotAgent.syncHullGroup()
      .then(() => {
        const segments = req.hull.ship.private_settings.synchronized_segments;
        if (segments.length === 0) {
          return req.shipApp.hullAgent.requestExtract({});
        }
        return Promise.map(segments, segmentId => {
          return req.shipApp.hullAgent.requestExtract({ segment: { id: segmentId }, remove: true });
        });
      });
  }
}
