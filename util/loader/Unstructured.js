const { UnstructuredLoader } = require("langchain/document_loaders/fs/unstructured");

async function documentosNoEstructurados(fileUrl) {
    const options = {
        apiKey: process.env.API_UNSTRUCTURED
    };

    const loader = new UnstructuredLoader(fileUrl, options);
    const docs = await loader.load();
    return docs;
}

module.exports = {
	documentosNoEstructurados
}