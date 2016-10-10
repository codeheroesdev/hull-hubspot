import _ from "lodash";
import Promise from "bluebird";


const TYPES_MAPPING = {
  string: { type: "string", fieldType: "text" },
  number: { type: "number", fieldType: "text" },
  date: { type: "datetime", fieldType: "text" },
  boolean: {
    type: "bool",
    fieldType: "booleancheckbox",
    options: [
      {
        description: null,
        doubleData: 0,
        label: "Yes",
        displayOrder: -1,
        hidden: false,
        readOnly: false,
        value: true
      },
      {
        description: null,
        doubleData: 0,
        label: "No",
        displayOrder: -1,
        hidden: false,
        readOnly: false,
        value: false
      }
    ]
  }
};


export default class ContactProperty {

  static sync(hubspotClient, { segments, groups, properties, logger }) {
    const instance = new ContactProperty(hubspotClient, { logger });
    return instance.sync({ segments, groups, properties });
  }

  constructor(hubspot, { logger }) {
    this.hubspot = hubspot;
    this.logger = logger;
  }

  sync({ segments, groups, properties }) {
    const propertiesList = this.getPropertiesList({ segments, properties });
    this.ensureHullGroup(groups)
      .then(this.ensureCustomProperties.bind(this, propertiesList))
      .catch(err => {
        this.logger.warn("Error in ContactProperty sync", { message: err.message });
      });
  }

  ensureHullGroup(groups) {
    const group =_.find(groups, g => g.name === "hull");
    if (group) return Promise.resolve(group);
    return this.hubspot
              .post("/contacts/v2/groups")
              .send({
                name: "hull",
                displayName: "Hull Properties",
                displayOrder: 1
              }).then(res => res.body);
  }

  ensureCustomProperties(propertiesList, group = {}) {
    const groupProperties = (group.properties || []).reduce((props,prop) => {
      return Object.assign(props, { [prop.name]: prop });
    }, {});
    return Promise.all(propertiesList.map(this.ensureProperty.bind(this, groupProperties)))
                  .then((...props) => console.warn("Done updating props", { props }));
  }

  shouldUpdateProperty(currentValue, newValue) {
    if (newValue.name === 'hull_segments') {
      const currentSegmentNames = (currentValue.options || []).map(o => o.label).sort();
      const newSegmentNames = (newValue.options || []).map(o => o.label).sort();
      return !_.isEqual(currentSegmentNames, newSegmentNames);
    }
    return false;
  }

  ensureProperty(groupProperties, property) {
    const exists = groupProperties[property.name];
    if (exists) {
      if (this.shouldUpdateProperty(exists, property)) {
        return this.hubspot
                  .put(`/contacts/v2/properties/named/${property.name}`)
                  .send(property)
                  .then(res => res.body);
      } else {
        return Promise.resolve(exists);
      }
    } else {
      return this.hubspot
                .post("/contacts/v2/properties")
                .send(property)
                .then(res => res.body);
    }
  }

  getPropertiesList({ properties, segments }) {
    return [
        this.getHullSegmentsProperty(segments)
      ]
      .concat(properties.map(({ type, title, id, path = [] }, displayOrder) => {
      const name = `hull_${id.replace(/^traits_/, '').replace(/\//g, '_')}`;
      const label = path.concat(title).join(" ");

      const propType = TYPES_MAPPING[type] || TYPES_MAPPING.string;

      return {
        ...propType,
        name,
        label,
        displayOrder,
        calculated: false,
        groupName: "hull",
        formField: false
      };
    }));
  }

  getHullSegmentsProperty(segments = []) {
    const options = _.map(segments, (s, i) => this.optionsHash(s.name, i));
    return {
      options,
      description: "All the Segments the User belongs to in Hull",
      label: "Hull Segments",
      groupName: "hull",
      fieldType: "checkbox",
      formField: false,
      name: "hull_segments",
      type: "enumeration",
      displayOrder: 0
    };
  }

  optionsHash(name, i) {
    return {
      hidden: false,
      description: null,
      value: _.trim(name),
      readOnly: false,
      doubleData: 0.0,
      label: name,
      displayOrder: i
    };
  }
}
