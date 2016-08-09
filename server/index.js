import Hull from "hull";
import winstonLogzio from "winston-logzio";
// import winstonSlacker from "winston-slacker";
import Server from "./server";

require("dotenv").config();


if (process.env.NODE_ENV === "development") Hull.logger.transports.console.level = "debug";

// Post to Slack Channel directly.
// Hull.logger.add(winstonSlacker,  { webhook, channel, username, iconUrl, iconImoji, customFormatter });

if (process.env.LOGZIO_TOKEN) Hull.logger.add(winstonLogzio, { token: process.env.LOGZIO_TOKEN });

Server({
  Hull,
  clientID: process.env.HUBSPOT_CLIENT_ID,
  clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
  hostSecret: process.env.SECRET || "1234",
  devMode: process.env.NODE_ENV === "development",
  port: process.env.PORT || 8082
});
