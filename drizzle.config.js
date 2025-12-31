require('dotenv').config();

/** @type { import("drizzle-kit").Config } */
module.exports = {
  schema: "./src/db/drizzle_schema.js",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
