import _ from "lodash";

export default class BatchController {
  /**
   * public method which queues the handleBatchExtractJob
   * @param  {Object} req
   * @param  {Object} res
   * @return {Promise}
   */
  handleBatchExtractAction(req, res) {
    const segmentId = req.query.segment_id || null;
    return req.shipApp.queueAgent.create("handleBatchExtractJob", {
      body: req.body,
      chunkSize: 100,
      segmentId
    })
    .then(() => res.end("ok"));
  }

  /**
   * Parses the extract results and queues chunks for export operations
   * @param  {String} body
   * @param  {Number} chunkSize
   * @return {Promise}
   */
  handleBatchExtractJob(req) {
    return req.shipApp.hullAgent.handleExtract(req.payload.body, req.payload.chunkSize, (usersBatch) => {
      if (req.payload.segmentId) {
        usersBatch = usersBatch.map(u => {
          u.segment_ids = _.uniq(_.concat(u.segment_ids || [], [req.payload.segmentId]));
          return u;
        });
      }
      const filteredUsers = usersBatch.filter((user) => req.shipApp.hullAgent.shouldSyncUser(user));
      return req.shipApp.queueAgent.create("sendUsersJob", {
        users: filteredUsers
      });
    });
  }
}
