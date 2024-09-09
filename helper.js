const pdfText = `Setting clear fitness goals is essential for a successful workout regimen, whether it's to build muscle, lose weight, or improve cardiovascular health. Strength training helps build muscle, boosts metabolism, and improves bone density, while cardiovascular exercises like running or cycling improve heart health and endurance. A balanced workout plan includes strength training, cardio, and flexibility exercises for a full-body workout. Recovery, proper nutrition, and hydration are crucial for optimal performance and muscle repair. Tracking progress, incorporating flexibility exercises, avoiding common mistakes, and ensuring quality sleep are important for maintaining motivation and achieving fitness goals. Mixing up workouts helps in targeting different muscle groups and preventing plateaus.`;

//chunking
function splitTextByFullStops(text) {
    const sentences = text.split('.');
    const chunks = [];
    let currentChunk = '';

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (currentChunk.length + sentence.length + 1 <= 300) {
            currentChunk += sentence + '.';
        } else {
            chunks.push(currentChunk);
            currentChunk = sentence + '.';
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    getEmbeddingsFromCohere(chunks);
    return chunks;
}

// Example usage:
const chunks = splitTextByFullStops(pdfText);
console.log(chunks);



async function getEmbeddingsFromCohere(chunks) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", "Bearer YOUR_COHERE_API_KEY");

    const raw = JSON.stringify({
        "texts": chunks
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    try {
        const response = await fetch("https://api.cohere.com/v1/embed", requestOptions);
        const data = await response.json();
        const embeddings = data.embeddings;
        console.log("Embedding for chunk:", embeddings);
        return embeddings;
    } catch (error) {
        console.error(error);
        return [];
    }
}
