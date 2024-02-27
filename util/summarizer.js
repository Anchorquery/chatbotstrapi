const { OpenAI } =  require("langchain/llms/openai");
const { templates } = require('./templates');
const { PromptTemplate } = require ("langchain/prompts");
const Bottleneck = require("bottleneck").default;
const { StructuredOutputParser } = require("langchain/output_parsers");


const { LLMChain } = require("langchain/chains");
const llm = new OpenAI({ concurrency: 10, temperature: 0, modelName: "gpt-3.5-turbo" });


let limitCharacteerLength = 8000;

const { summarizerTemplate, summarizerDocumentTemplate } = templates;

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  answer: "answer to the user's question",
  source: "source used to answer the user's question, should be a website.",
});

//const formatInstructions = parser.getFormatInstructions();

const limiter = new Bottleneck({
  minTime: 5050
});


const chunkSubstr = (str, size) => {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }

  return chunks;
};

const summarize = async ({ document, inquiry, onSummaryDone }) => {
  strapi.log.debug("summarizing ", document.length);
  const promptTemplate = new PromptTemplate({
    template: inquiry ? summarizerTemplate : summarizerDocumentTemplate,
    inputVariables: inquiry ? ["document", "inquiry"] : ["document"],
  });
  const chain = new LLMChain({
    prompt: promptTemplate,
    llm
  });

  try {
    const result = await chain.call({
      prompt: promptTemplate,
      document,
      inquiry
    });

    strapi.log.debug(result);

    onSummaryDone && onSummaryDone(result.text);
    return result.text;
  } catch (e) {
    strapi.log.debug(e);
  }
};

const rateLimitedSummarize = limiter.wrap(summarize);

const summarizeLongDocument = async ({ document, inquiry, onSummaryDone, forceSummarize =false }) => {
  if(forceSummarize ) {
			strapi.log.debug("FORZADO", limitCharacteerLength);
			limitCharacteerLength = 0;
		}
  const templateLength = inquiry ? summarizerTemplate.length : summarizerDocumentTemplate.length;
  try {
    if ((document.length + templateLength) > limitCharacteerLength) {
      strapi.log.debug("document is long and has to be shortened", document.length);
      strapi.log.debug("templateLength", templateLength);
      strapi.log.debug("limitCharacteerLength", limitCharacteerLength);
      strapi.log.debug("templateLenght - limitCharacteerLength - 1", templateLength - limitCharacteerLength - 1);
      const chunks = chunkSubstr(document, limitCharacteerLength - templateLength - 1);
      strapi.log.debug("chunks", chunks.length);
      let summarizedChunks = [];
      summarizedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          let result;
          if (inquiry) {
            // @ts-ignore
            result = await rateLimitedSummarize({ document: chunk, inquiry, onSummaryDone });
          } else {
            // @ts-ignore
            result = await rateLimitedSummarize({ document: chunk, onSummaryDone });
          }
          return result;
        })
      );

      const result = summarizedChunks.join("\n");


      if ((result.length + templateLength) > limitCharacteerLength) {
        strapi.log.debug("document is STILL long and has to be shortened further");
        return await summarizeLongDocument({ document: result, inquiry, onSummaryDone, forceSummarize });
      } else {
        strapi.log.debug("done");
        return result;
      }

    } else {
      return document;
    }
  } catch (e) {
    throw new Error(e);
  }
};

module.exports = { summarizeLongDocument };
