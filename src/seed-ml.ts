import axios from 'axios';

async function seedData() {
    console.log('Seeding 60 normal requests...');

    for (let i = 0; i < 60; i++) {
        try {
            await axios.get('http://localhost:3000/proxy/openai/v1/models');
            process.stdout.write('.');
        } catch (e) {
            process.stdout.write('.');
        }
    }

    console.log('\n Seeding complete. Triggering ML training...');

    try {
        const response = await axios.post('http://localhost:3000/ml/retrain');
        console.log('ML Training Response:', response.data);
    } catch (e: any) {
        console.error('ML Training failed:', e.message);
    }

    console.log('\n Simulating ANOMALOUS request (High Latency)...');
    // Note: We can't easily force high latency from client-side proxy unless we mock it, 
    // but we can try an endpoint that doesn't exist to change the 'signature'
    try {
        await axios.post('http://localhost:3000/proxy/openai/v1/suspicious-endpoint-999');
    } catch (e) { }
}

seedData();
