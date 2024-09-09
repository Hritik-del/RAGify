const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const axios = require('axios');

oracledb.initOracleClient({ libDir: 'C:/oracle/instantclient-basic-windows.x64-23.4.0.24.05/instantclient_23_4' });


const app = express();

// Enable CORS
app.use(cors());

// Add body parsing middleware
app.use(bodyParser.json());

app.post('/search', async (req, res) => {
    const userInput = req.body.userInput;
    const response = await getEmbeddingsFromCohere(userInput);

    console.log('User input embeddings', response.data.embeddings);
    const userInputEmbedding = response.data.embeddings[0];

    if (!Array.isArray(userInputEmbedding)) {
        console.error('Error: userInputEmbedding is not an array');
        // Handle the error appropriately
        return;
    }
    var connection;
    try {
            connection = await connectToDatabase();

            const sql = `
            SELECT CHUNK_C, CHUNK_V
            FROM FITNESS_INFO
          `;

            const result = await connection.execute(sql);

            const similarChunks = await Promise.all(
                result.rows.map(async (row) => {
                    const chunkCLOB = row[0]; // CHUNK_C
                    const chunkText = await chunkCLOB.getData(); // Retrieve CLOB data as a string
                    const chunkEmbedding = row[1]; // CHUNK_V (Embedding)
                    const similarity = calculateCosineSimilarity(userInputEmbedding, chunkEmbedding);
                    console.log('Similarity score', similarity);
                    return { chunkText, similarity };
                })
            );

            const top5RAGChunks = similarChunks
                .filter(chunkObj => chunkObj.similarity > 0.0) // Adjust the threshold as needed
                .sort((a, b) => b.similarity - a.similarity) // Sort by similarity in descending order
                .slice(0, 5) // Get the top 5 chunks
                .map(chunkObj => chunkObj.chunkText); // Extract the chunkText


            console.log('Top 5 Chunks:', top5RAGChunks);

            // Step 1: Reorder chunks with Cohere's Reranker
            const top3Chunks = await getTopReorderedChunksFromCohere(top5RAGChunks, userInput);
            console.log("Top 3 Chunks after Reranking: ", top3Chunks);

            // Step 2: Generate response with CommandR+
            const finalResponse = await generateResponseWithCommandRPlus(userInput, top3Chunks);
            console.log("Final Response from Cohere CommandR+ Model: ", finalResponse);

        //Process the similar chunks and generate a response
        const response = {
            message: 'Search results',
            data: finalResponse // Return the array of top 5 chunks
        };

        res.json(response);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        // Close the database connection
        if (connection) {
            await connection.close();
        }
    }
});

// Endpoint to get embeddings from Cohere
async function getEmbeddingsFromCohere(...chunks) {
    let data = JSON.stringify({
        "texts": chunks
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.cohere.com/v1/embed',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_BEARER_TOKEN'
        },
        data: data
    };

    try {
        const response = await axios.request(config);
        // console.log(JSON.stringify(response.data));
        return response;
    } catch (error) {
        console.error(error);
        throw error;  // Rethrow the error if you want to handle it later
    }
}


function calculateCosineSimilarity(vector1, vector2) {
    // console.log('chunk embedding from database', vector2);
    // Calculate dot product
    const dotProduct = vector1.reduce((sum, value, index) => sum + value * vector2[index], 0);
    
    // Calculate magnitude of vector1
    const magnitude1 = Math.sqrt(vector1.reduce((sum, value) => sum + value * value, 0));
    
    // Calculate magnitude of vector2
    const magnitude2 = Math.sqrt(vector2.reduce((sum, value) => sum + value * value, 0));
    
    // Calculate cosine similarity
    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
    
    return cosineSimilarity;
}

async function connectToDatabase() {
    const user = `USER_NAME`;
    const password = `PASSWORD`;
    const connectionString = `TNS_STRING`;
    
    try {
        const connection = await oracledb.getConnection({
            // Your connection details
            user,
            password,
            connectString: connectionString
        });
        console.log('Connection to database success');
        return connection;
    } catch (error) {
        console.error('Error connecting to database:', error);
        throw error; // Rethrow the error to be handled in the calling function
    }
}

async function getTopReorderedChunksFromCohere(top5Chunks, userInput) {
    let data = JSON.stringify({
        "documents": top5Chunks,
        "query": userInput,
        "top_n": 3
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.cohere.com/v1/rerank',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_BEARER_TOKEN'
        },
        data: data
    };

    try {
        const response = await axios.request(config);
        const responseJson = response.data;

        const top3Chunks = responseJson.results.map((ele) => {
            const index = ele.index;
            if (index >= 0 && index < top5Chunks.length) {
                return top5Chunks[index];
            } else {
                console.warn(`Warning: Invalid index ${index} in response.`);
                return null;
            }
        });

        return top3Chunks.join(' ');
    } catch (error) {
        console.error(error);
        throw error;  // Rethrow the error if you want to handle it later
    }
}

async function generateResponseWithCommandRPlus(userInput, topChunks) {
    let data = JSON.stringify({
        "message": userInput + " " + topChunks,
        "model": "command-r-plus-08-2024"
    });

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.cohere.com/v1/chat',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_BEARER_TOKEN'
        },
        data: data
    };

    try {
        const response = await axios.request(config);
        return response.data.text;
    } catch (error) {
        console.error(error);
        throw error;  // Rethrow the error if you want to handle it later
    }
}


// Start the server and listen for incoming requests
const port = process.env.PORT || 3000; // Use environment variable for port
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});