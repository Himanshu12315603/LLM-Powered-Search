import express from 'express';
import z from 'zod';
import { tavily } from '@tavily/core'
import { Output, streamText } from 'ai';
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from './prompt';

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
const app = express();
app.use(express.json());


app.post("/purplexity_ask", async(req, res) => {

    //step 1 -  get the query from the user
    const query = req.body.query;

    // step 2 -  make sure user has access/credits to hit the endpoint 
    // step 3  - check if we have web search indexed for a similar query 
    // step 4 - hit web search to gather resoures

    const webSearchResponse = await client.search(query, {
        searchDepth: "advanced"
    });
    const webSearchResults = webSearchResponse.results;

    // do some context engineering on the promt + web search responce 

    // step 5 - hit the LLM and stream back the response 
    // hit the LLM? LLM api/operater 
    const prompt = PROMPT_TEMPLATE
        .replace("{{WEB_SEARCH_RESULTS}", JSON.stringify(webSearchResults))
        .replace("{{USER_QUERY}}", query);

    const result = streamText({
        model: 'auto',
        prompt: prompt,
        system: SYSTEM_PROMPT,
    });

    res.header('Cache-Control', 'no-cache');
    res.header('Content-Type', 'text/event-stream');

    for await (const textPart of result.textStream) {
        res.write(textPart);
    }

    res.write("-----------SOURCES-----------");

    // step 7 - also stream back the soursces or follow up questions which we can from another pararell form 
    webSearchResults.forEach((result => (JSON.stringify(result))))

    // step 8 - close the event stream 
    res.end();

});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});