import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { MongoClient } from "mongodb";

declare module "fastify" {
  interface FastifyInstance {
    mongo: {
      client: MongoClient;
      db: any;
    };
  }
}

export default fp(async function (fastify: FastifyInstance) {
  const url = process.env.MONGODB_URL || "mongodb://localhost:27017";
  const dbName = process.env.MONGODB_DB_NAME || "quotes";

  const client = new MongoClient(url);

  try {
    await client.connect();
    const db = client.db(dbName);

    fastify.decorate("mongo", { client, db });

    fastify.addHook("onClose", async () => {
      await client.close();
    });

    fastify.log.info("Connected to MongoDB");
  } catch (error: any) {
    fastify.log.error("Failed to connect to MongoDB:", error);
    throw error;
  }
});

export { fp as databasePlugin };
