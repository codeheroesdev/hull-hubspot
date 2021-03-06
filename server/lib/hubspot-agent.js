import moment from "moment";
import Promise from "bluebird";
import _ from "lodash";
import promiseRetry from "promise-retry";


export default class HubspotAgent {

  constructor(hullAgent, hullClient, hubspotClient, ship, instrumentationAgent) {
    this.hullAgent = hullAgent;
    this.hullClient = hullClient;
    this.hubspotClient = hubspotClient;
    this.ship = ship;
    this.instrumentationAgent = instrumentationAgent;
  }

  isConfigured() {
    return !_.isEmpty(this.ship.private_settings.token);
  }

  /**
   * This is a wrapper which handles the access_token errors for hubspot queries
   * and runs `checkToken` to make sure that our token didn't expire.
   * Then it retries the query once.
   * @param {Promise} promise
   */
  retryUnauthorized(promise) {
    return promiseRetry(retry => {
      return promise()
        .catch(err => {
          if (err.response.unauthorized) {
            this.hullClient.logger.info("retrying query", _.get(err, "response.body"));
            return this.checkToken({ force: true })
              .then(() => {
                this.hubspotClient.ship = this.ship;
                return true;
              })
              .then(() => retry(err));
          }
          this.hullClient.logger.error("non recoverable error", err.response);
          return Promise.reject(err);
        });
    }, { retries: 0 })
    .catch(err => {
      const simplifiedErr = new Error(_.get(err.response, "body.message"));
      simplifiedErr.extra = JSON.stringify(_.get(err.response, "body") || {});
      return Promise.reject(simplifiedErr);
    });
  }

  checkToken({ force = false } = {}) {
    let { token_fetched_at, expires_in } = this.ship.private_settings;
    if (!token_fetched_at || !expires_in) {
      this.hullClient.logger.error("checkToken: Ship private settings lack token information");
      token_fetched_at = moment().utc().format("x");
      expires_in = 0;
    }

    const expiresAt = moment(token_fetched_at, "x").add(expires_in, "seconds");
    const willExpireIn = expiresAt.diff(moment(), "seconds");
    const willExpireSoon = willExpireIn <= (process.env.HUBSPOT_TOKEN_REFRESH_ADVANCE || 600); // 10 minutes
    this.hullClient.logger.info("access_token", {
      fetched_at: moment(token_fetched_at, "x").format(),
      expires_in,
      expires_at: expiresAt.format(),
      will_expire_in: willExpireIn,
      utc_now: moment().format(),
      will_expire_soon: willExpireSoon
    });
    if (willExpireSoon || force) {
      return this.hubspotClient.refreshAccessToken()
        .catch(refreshErr => {
          this.hullClient.logger.error("Error in refreshAccessToken", refreshErr);
          return Promise.reject(refreshErr);
        })
        .then((res) => {
          return this.hullAgent.updateShipSettings({
            expires_in: res.body.expires_in,
            token_fetched_at: moment().utc().format("x"),
            token: res.body.access_token
          });
        })
        .then((ship) => {
          this.ship = ship;
          return "refreshed";
        });
    }
    return Promise.resolve("valid");
  }

  /**
  * Get 100 hubspot contacts and queues their import
  * and getting another 100 - needs to be processed in one queue without
  * any concurrency
  * @see http://developers.hubspot.com/docs/methods/contacts/get_contacts
  * @param  {Number} [count=100]
  * @param  {Number} [offset=0]
  * @return {Promise}
  */
  getContacts(properties, count = 100, offset = 0) {
    if (count > 100) {
      return this.hullClient.logger.error("getContact gets maximum of 100 contacts at once", count);
    }

    return this.retryUnauthorized(() => {
      return this.hubspotClient
        .get("/contacts/v1/lists/all/contacts/all")
        .query({
          count,
          vidOffset: offset,
          property: properties
        });
    });
  }

  /**
  * Get most recent contacts and filters out these who last modification
  * time if older that the lastImportTime. If there are any contacts modified since
  * that time queues import of them and getting next chunk from hubspot API.
  * @see http://developers.hubspot.com/docs/methods/contacts/get_recently_updated_contacts
  * @param  {Date} lastImportTime
  * @param  {Number} [count=100]
  * @param  {Number} [offset=0]
  * @return {Promise -> Array}
  */
  getRecentContacts(properties, lastImportTime, count = 100, offset = 0) {
    return this.retryUnauthorized(() => {
      return this.hubspotClient
        .get("/contacts/v1/lists/recently_updated/contacts/recent")
        .query({
          count,
          vidOffset: offset,
          property: properties
        });
    })
    .then((res) => {
      res.body.contacts = res.body.contacts.filter((c) => {
        return moment(c.properties.lastmodifieddate.value, "x")
          .milliseconds(0)
          .isAfter(lastImportTime);
      });
      return res;
    });
  }

  batchUsers(body) {
    if (_.isEmpty(body)) {
      return Promise.resolve(null);
    }
    return this.retryUnauthorized(() => {
      return this.hubspotClient.post("/contacts/v1/contact/batch/")
        .query({
          auditId: "Hull"
        })
        .set("Content-Type", "application/json")
        .send(body);
    });
  }

  /**
  * Get information about last import done from Hubspot.
  * It tries to get the data from user's information, if not available
  * defaults to one hour from now.
  *
  * @return {Promise -> lastImportTime (ISO 8601)} 2016-08-04T12:51:46Z
  */
  getLastFetchAt() {
    const defaultValue = moment().subtract(1, "hour").format();
    const lastFetchAt = _.get(this.hullAgent.getShipSettings(), "last_fetch_at", defaultValue);
    return lastFetchAt;
  }

  setLastFetchAt() {
    return this.hullAgent.updateShipSettings({
      last_fetch_at: moment().format()
    });
  }
}
