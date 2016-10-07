import Promise from "bluebird";
import kue from "kue";

/**
 * Kue Adapter for queue
 */
export default class KueAdapter {

  /**
   * @param {Object} queue Kue instance
   */
  constructor(options) {
    this.options = options;
    this.queue = kue.createQueue(options);
    this.queue.watchStuckJobs();
    this.app = kue.app;
  }

  /**
   * @param {String} jobName queue name
   * @param {Object} jobPayload
   * @return {Promise}
   */
  create(jobName, jobPayload, ttl = 0) {
    return Promise.fromCallback((callback) => {
      const job = this.queue.create(jobName, jobPayload)
        .ttl(ttl)
        .removeOnComplete(true)
        .save(function saveHandler(err) {
          callback(err, job.id);
        });
    });
  }

  /**
   * @param {String} jobName
   * @param {Function -> Promise} jobCallback
   * @return {Object} this
   */
  process(jobName, jobCallback) {
    return this.queue.process(jobName, (job, done) => {
      jobCallback(job)
        .then((res) => {
          done(null, res);
        }, (err) => {
          done(err);
        })
        .catch((err) => {
          console.err("err", err);
          done(err);
        });
    });
  }

  exit() {
    return Promise.fromCallback((callback) => {
      this.queue.shutdown(5000, callback);
    });
  }
}
