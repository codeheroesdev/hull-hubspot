const Minibase = require("minihull/src/minibase");

class Minihubspot extends Minibase {
  constructor(options = {}) {
    super(options);
    this.db.defaults({ contacts: [] }).write();
    this.app.get("/contacts/v1/lists/all/contacts/all", (req, res) => {
      res.json({
        contacts: this.db.get("contacts").value()
      });
    });
    this.app.get("/contacts/v2/groups", (req, res) => {
      res.json([]);
    });
    this.app.post("/contacts/v2/groups", (req, res) => {
      res.json([]);
    });

    this.app.post("/contacts/v2/properties", (req, res) => {
      res.json([]);
    });
  }

  fakeUsers(count) {
    return this.db.get("contacts").push({
      id: "123",
      name: "test"
    }).write();
  }
}

module.exports = Minihubspot;
