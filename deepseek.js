require('dotenv').config();
const axios = require('axios');

async function callDeepSeek(prompt) {
  const response = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.choices[0].message.content;
}

module.exports = { callDeepSeek };

if (require.main === module) {
  (async () => {
    const result = await callDeepSeek('Rispondi solo: ok');
    console.log(result);
  })();
}
