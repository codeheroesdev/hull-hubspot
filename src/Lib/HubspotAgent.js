import moment from "moment";
import Promise from "bluebird";

export default class HubspotAgent {

  constructor(hullAgent, hullClient, mapping, hubspotClient) {
    this.hullAgent = hullAgent;
    this.hullClient = hullClient;
    this.mapping = mapping;
    this.hubspotClient = hubspotClient;
  }

  checkToken() {
    return this.hubspotClient
      .get("/contacts/v1/lists/recently_updated/contacts/recent")
      .query({ count: 1 })
      .then(() => {
        return "valid"
      })
      .catch((err) => {
        if (err.response.statusCode) {
          return this.hubspotClient.refreshAccessToken()
            .then((res) => {
              return this.hullAgent.updateShipSettings({
                token: res.body.access_token
              });
            })
            .then(() => {
              return "refreshed";
            });
        }
      });
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
  getContacts(count = 100, offset = 0) {
    if (count > 100) {
      return this.hullClient.logger.error("getContact gets maximum of 100 contacts at once", count);
    }

    const properties = this.mapping.getHubspotPropertiesKeys();

    return this.hubspotClient
      .get("/contacts/v1/lists/all/contacts/all")
      .query({
        count,
        vidOffset: offset,
        property: properties
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
  getRecentContacts(lastImportTime, count = 100, offset = 0) {
    const properties = this.mapping.getHubspotPropertiesKeys();
    return this.hubspotClient
      .get("/contacts/v1/lists/recently_updated/contacts/recent")
      .query({
        count,
        vidOffset: offset,
        property: properties
      })
      .then((res) => {
        res.body.contacts = res.body.contacts.filter((c) => {
          return moment(c.properties.lastmodifieddate.value, "x")
            .isAfter(lastImportTime);
        });
        return res;
      });
  }
}
