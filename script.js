const userInputElement = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatMessagesElement = document.querySelector('.chat-messages');
const loadingSpinner = document.getElementById('loading-spinner');

sendButton.addEventListener('click', handleSendButtonClick);

async function handleSendButtonClick() {
  const userInput = userInputElement.value;

  if (userInput.trim() !== '') {
    try {
      // Show loading spinner
      loadingSpinner.hidden = false;

      const response = await fetch('http://127.0.0.1:3000/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userInput: userInput })
      }).then(response => response.json());

      console.log(response);

      const finalResponse = response.data;
      // Assuming the response is in a JSON format
      const userMessage = document.createElement('div');
      userMessage.classList.add('chat-message', 'user-message');
      userMessage.textContent = userInput;
      chatMessagesElement.appendChild(userMessage);

      const botMessage = document.createElement('div');
      botMessage.classList.add('chat-message', 'bot-message');
      botMessage.innerHTML = marked.parse(finalResponse || 'Hanged!! Please come back after some time.');
      chatMessagesElement.appendChild(botMessage);

      userInputElement.value = '';
      chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;

    } catch (error) {
      console.error('Error:', error);
    } finally {
      // Hide loading spinner
      loadingSpinner.hidden = true;
    }
  }
}

async function getTopReorderedChunksFromCohere(top5Chunks, userInput) {
  const myHeaders = new Headers();
  myHeaders.append("Authorization", "Bearer YOUR_BEARER_TOKEN");
  myHeaders.append("Content-Type", "application/json");

  const raw = JSON.stringify({
    "documents": top5Chunks,
    "query": userInput,
    "top_n": 3
  });

  const requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow'
  };

  const response = await fetch("https://api.cohere.com/v1/rerank", requestOptions);
  const responseJson = await response.json();

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
}

async function generateResponseWithCommandRPlus(userInput, topChunks) {
  const myHeaders = new Headers();
  myHeaders.append("Authorization", "Bearer YOUR_BEARER_TOKEN");
  myHeaders.append("Content-Type", "application/json");

  const raw = JSON.stringify({
    "message": userInput + " " + topChunks,
    "model": "command-r-plus-08-2024"
  });

  const requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow'
  };

  const response = await fetch("https://api.cohere.com/v1/chat", requestOptions)
    .then(response => response.json());

  return response.text;
}

async function getEmbeddingsFromCohere(...chunks) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", "Bearer YOUR_BEARER_TOKEN");

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
    // console.log("Embedding for chunk:", embeddings);
    return embeddings;
  } catch (error) {
    console.error(error);
    return [];
  }
}

