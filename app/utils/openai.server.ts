import OpenAI from "openai";

const apiKeys = [
  "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",
"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",
"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"
];

function getRandomApiKey() {
  return apiKeys[Math.floor(Math.random() * apiKeys.length)];
}

const openai = new OpenAI({
    apiKey: getRandomApiKey()
  });

export default openai;