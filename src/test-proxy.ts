import axios from 'axios';

async function testProxy() {
    console.log('--- Testing SaaS-Sentinel Proxy ---');

    try {
        console.log('1. Testing Health Check...');
        const health = await axios.get('http://localhost:3000/health');
        console.log('Health:', health.data);

        console.log('\n2. Testing OpenAI Proxy (Expect 401 Unauthorized)...');
        try {
            const openai = await axios.post('http://localhost:3000/proxy/openai/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Hello' }]
            });
            console.log('OpenAI Response:', openai.status);
        } catch (err: any) {
            console.log('OpenAI Status (Expected):', err.response?.status || err.message);
        }

        console.log('\n3. Fetching Metrics...');
        const metrics = await axios.get('http://localhost:3000/metrics');
        console.log('Current Metrics:', metrics.data);

    } catch (error: any) {
        console.error('Test Failed:', error.message);
    }
}

testProxy();
