import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../src/config/env.js";

async function main() {
  const isCreate = process.argv.includes("--create");

  console.log("=== Pinecone Diagnostic Check ===");
  console.log("PINECONE_API_KEY set:", Boolean(env.pineconeApiKey && env.pineconeApiKey !== "dummy-pinecone-key"));
  console.log("PINECONE_INDEX:", env.pineconeIndex);

  if (!env.pineconeApiKey || env.pineconeApiKey === "dummy-pinecone-key") {
    console.error("PINECONE_API_KEY is not configured with a valid key.");
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey: env.pineconeApiKey });

  try {
    console.log("Fetching index list (SDK: pc.listIndexes())...");
    const indexList = await pc.listIndexes();
    const existingIndexNames = (indexList.indexes ?? []).map((idx) => idx.name);
    console.log("Available indexes:", existingIndexNames);

    const exists = existingIndexNames.includes(env.pineconeIndex);
    console.log(`Index '${env.pineconeIndex}' exists:`, exists);

    if (!exists) {
      if (isCreate) {
        console.log(`Creating index '${env.pineconeIndex}' (dimension: 1024, metric: cosine, serverless: aws/us-east-1)...`);
        await pc.createIndex({
          name: env.pineconeIndex || "tailorcv-facts",
          dimension: 1024,
          metric: "cosine",
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-east-1",
            },
          },
          waitUntilReady: true,
        });
        console.log(`Index '${env.pineconeIndex}' created and ready.`);
      } else {
        console.log(`Index '${env.pineconeIndex}' does not exist. Run with --create to create it.`);
        process.exit(1);
      }
    }

    console.log(`Describing index (SDK: pc.describeIndex('${env.pineconeIndex}'))...`);
    const description = await pc.describeIndex(env.pineconeIndex);
    console.log("Dimension:", description.dimension);
    console.log("Metric:", description.metric);
    console.log("Status Ready:", description.status?.ready);
    console.log("Status State:", description.status?.state);
    console.log("Spec:", JSON.stringify(description.spec));

    console.log(`Describing index stats (SDK: pc.index({ name: '${env.pineconeIndex}' }).describeIndexStats())...`);
    const indexClient = pc.index({ name: env.pineconeIndex });
    const stats = await indexClient.describeIndexStats();
    console.log("Total record count:", stats.totalRecordCount);
    console.log("Namespaces:", stats.namespaces);

    console.log("=== Check Completed Successfully ===");
  } catch (err) {
    console.error("Pinecone check failed:", err.name, err.code ?? "", err.status ?? err.statusCode ?? "");
    process.exit(1);
  }
}

main();
