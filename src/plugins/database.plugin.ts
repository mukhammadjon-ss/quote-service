import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { MongoClient, Db } from "mongodb";

// Declare the mongo property on FastifyInstance
declare module "fastify" {
  interface FastifyInstance {
    mongo: {
      client: MongoClient;
      db: Db;
    };
  }
}

interface DatabasePluginOptions {
  url?: string;
  dbName?: string;
}

const databasePlugin: FastifyPluginAsync<DatabasePluginOptions> = async (
  fastify: FastifyInstance,
  options: DatabasePluginOptions
) => {
  const url =
    options.url || process.env.MONGODB_URL || "mongodb://localhost:27017";
  const dbName = options.dbName || process.env.MONGODB_DB_NAME || "quotes";

  fastify.log.info(`Attempting to connect to MongoDB: ${url}`);

  const client = new MongoClient(url);

  try {
    await client.connect();
    const db = client.db(dbName);

    // Test the connection
    await db.admin().ping();

    fastify.decorate("mongo", { client, db });

    fastify.addHook("onClose", async () => {
      await client.close();
      fastify.log.info("MongoDB connection closed");
    });

    fastify.log.info(`Connected to MongoDB database: ${dbName}`);
  } catch (error: any) {
    fastify.log.error("Failed to connect to MongoDB:", error);
    throw error;
  }
};

// Important: Make sure the plugin name matches what other plugins expect
export default fp(databasePlugin, {
  name: "database",
});