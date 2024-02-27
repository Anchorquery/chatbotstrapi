const { PineconeClient } = require("@pinecone-database/pinecone");
const { Crawler } = require('./crawler');
const { Document } = require("langchain/document");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const Bottleneck = require("bottleneck").default;
const { v4: uuid } = require("uuid");
const { TokenTextSplitter } = require("langchain/text_splitter");
const { summarizeLongDocument } = require("../summarizer");

const limiter = new Bottleneck({
  minTime: 50
});

let pinecone = null;

const initPineconeClient = async () => {
  pinecone = new PineconeClient();
  strapi.log.debug("init pinecone");
  await pinecone.init({
    environment: process.env.PINECONE_ENVIRONMENT,
    apiKey: process.env.PINECONE_API_KEY,
  });
};

const truncateStringByBytes = (str, bytes) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};

const sliceIntoChunks = (arr, chunkSize) => {
  return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
    arr.slice(i * chunkSize, (i + 1) * chunkSize)
  );
};

module.exports = async function handler(req, res) {
  if (!process.env.PINECONE_INDEX_NAME) {
    res.status(500).json({ message: "PINECONE_INDEX_NAME not set" });
    return;
  }

  const { query } = req;
  const { urls: urlString, limit, indexName, summarize } = query;
  const urls = (urlString || "").split(",");
  const crawlLimit = parseInt(limit || "1000", 10);
  const pineconeIndexName = indexName || process.env.PINECONE_INDEX_NAME;
  const shouldSummarize = summarize === "true";

  if (!pinecone) {
    await initPineconeClient();
  }

  const indexes = pinecone && (await pinecone.listIndexes());
  if (!indexes?.includes(pineconeIndexName)) {
    res.status(500).json({
      message: `Index ${pineconeIndexName} does not exist`
    });
    throw new Error(`Index ${pineconeIndexName} does not exist`);
  }

  const crawler = new Crawler(urls, crawlLimit, 200);
  const pages = await crawler.start();

  const documents = await Promise.all(pages.map(async row => {
    const splitter = new TokenTextSplitter({
      encodingName: "gpt2",
      chunkSize: 300,
      chunkOverlap: 20,
    });

    const pageContent = shouldSummarize
      // @ts-ignore
      ? await summarizeLongDocument({ document: row.text })
      : row.text;

    const docs = splitter.splitDocuments([
      new Document({ pageContent, metadata: { url: row.url, text: truncateStringByBytes(pageContent, 36000) } }),
    ]);
    return docs;
  }));

  const index = pinecone && pinecone.Index(pineconeIndexName);

  const embedder = new OpenAIEmbeddings({
    modelName: "text-embedding-ada-002"
  });
  let counter = 0;

  const getEmbedding = async (doc) => {
    const embedding = await embedder.embedQuery(doc.pageContent);
    strapi.log.debug(doc.pageContent);
    strapi.log.debug("got embedding", embedding.length);
    process.stdout.write(`${Math.floor((counter / documents.flat().length) * 100)}%\r`);
    counter = counter + 1;
    return {
      id: uuid(),
      values: embedding,
      metadata: {
        chunk: doc.pageContent,
        text: doc.metadata.text,
        url: doc.metadata.url,
      }
    };
  };
  process.stdout.write("100%\r");
  strapi.log.debug("done embedding");

  let vectors = [];

  try {

    vectors = await Promise.all(documents.flat().map((doc) => limiter.wrap(doc)));
    const chunks = sliceIntoChunks(vectors, 10);
    strapi.log.debug(chunks.length);

    try {
      await Promise.all(chunks.map(async chunk => {
        await index.upsert({
          upsertRequest: {
            vectors: chunk,
            namespace: ""
          }
        });
      }));

      res.status(200).json({ message: "Done" });
    } catch (e) {
      strapi.log.debug(e);
      res.status(500).json({ message: `Error ${JSON.stringify(e)}` });
    }
  } catch (e) {
    strapi.log.debug(e);
  }
};
