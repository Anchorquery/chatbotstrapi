const { getEnvironmentVariable } = require("@langchain/core/utils/env");
const { OpenAI:OpenAIClient } = require("openai");
const { Tool } = require("@langchain/core/tools");

class DallEAPIWrapper extends Tool {
    static lc_name() {
        return "DallEAPIWrapper";
    }
    constructor(fields) {
        super(fields);
        this.name = "dalle_api_wrapper";
        this.description = "A wrapper around OpenAI DALL-E API. Useful for when you need to generate images from a text description. Input should be an image description.plz output the full original url ended with params";
        this.client = undefined;
        this.modelName = "dall-e-3";
        this.style = "vivid";
        this.quality = "standard";
        this.n = 1;
        this.size = "1024x1024";
        this.responseFormat = "url";
        this.user = undefined;

        const openAIApiKey = fields?.openAIApiKey ?? getEnvironmentVariable("OPENAI_API_KEY");
        const organization = fields?.organization ?? getEnvironmentVariable("OPENAI_ORGANIZATION");
        const clientConfig = {
            baseURL: fields?.baseURL ?? "https://api.openai.com/v1",
            apiKey: openAIApiKey,
            organization,
            dangerouslyAllowBrowser: true,
        };
        this.client = new OpenAIClient(clientConfig);
        this.modelName = fields?.modelName ?? this.modelName;
        this.style = fields?.style ?? this.style;
        this.quality = fields?.quality ?? this.quality;
        this.n = fields?.n ?? this.n;
        this.size = fields?.size ?? this.size;
        this.responseFormat = fields?.responseFormat ?? this.responseFormat;
        this.user = fields?.user;
    }

    async _call(input) {
        const response = await this.client.images.generate({
            model: this.modelName,
            prompt: input,
            n: this.n,
            size: this.size,
            response_format: this.responseFormat,
            style: this.style,
            quality: this.quality,
            user: this.user,
        });
        let data = "";
        if (this.responseFormat === "url") {
            [data] = response.data
                .map((item) => item.url)
                .filter((url) => url !== "undefined");
            console.log(data)
        }
        else {
            [data] = response.data
                .map((item) => item.b64_json)
                .filter((b64_json) => b64_json !== "undefined");
        }
        return data;
    }
}

// Exportar DallEAPIWrapper para uso con require
module.exports = DallEAPIWrapper;


