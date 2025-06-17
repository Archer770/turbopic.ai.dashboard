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