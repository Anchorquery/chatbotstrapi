const { OpenAI } = require("langchain/llms");
const { templates } = require('./templates');
const { LLMChain, PromptTemplate } = require("langchain");
const Bottleneck = require("bottleneck").default;
const { StructuredOutputParser } = require("langchain/output_parsers");

const llm = new OpenAI({ concurrency: 10, temperature: 0, modelName: "gpt-3.5-turbo" });


let limitCharacteerLength = 4000;

const { summarizerTemplate, summarizerDocumentTemplate } = templates;

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  answer: "answer to the user's question",
  source: "source used to answer the user's question, should be a website.",
});

const formatInstructions = parser.getFormatInstructions();

const limiter = new Bottleneck({
  minTime: 5050
});


const chunkSubstr = (str, size) => {
  const numChunks = Math.ceil(str.length / size);
  console.log("numChunks", numChunks);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }

  return chunks;
};

const summarize = async ({ document, inquiry, onSummaryDone }) => {
  console.log("summarizing ", document.length);
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

    console.log(result);

    onSummaryDone && onSummaryDone(result.text);
    return result.text;
  } catch (e) {
    console.log(e);
  }
};

const rateLimitedSummarize = limiter.wrap(summarize);

const summarizeLongDocument = async ({ document, inquiry, onSummaryDone, forceSummarize =false }) => {
  if(forceSummarize ) {
			console.log("FORZADO", limitCharacteerLength);
			limitCharacteerLength = 0;
		}
  const templateLength = inquiry ? summarizerTemplate.length : summarizerDocumentTemplate.length;
  try {
    if ((document.length + templateLength) > limitCharacteerLength) {
      console.log("document is long and has to be shortened", document.length);
      console.log("templateLength", templateLength);
      console.log("limitCharacteerLength", limitCharacteerLength);
      console.log("templateLenght - limitCharacteerLength - 1", templateLength - limitCharacteerLength - 1);
      const chunks = chunkSubstr(document, limitCharacteerLength - templateLength - 1);
      console.log("chunks", chunks.length);
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
        console.log("document is STILL long and has to be shortened further");
        return await summarizeLongDocument({ document: result, inquiry, onSummaryDone, forceSummarize });
      } else {
        console.log("done");
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
