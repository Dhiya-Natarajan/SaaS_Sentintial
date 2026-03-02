// @ts-ignore
import { IsolationForest } from 'ml-isolation-forest';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

class SimpleScaler {
    private mins: number[] = [];
    private maxs: number[] = [];

    fit(data: number[][]) {
        if (data.length === 0) return;
        const numFeatures = data[0].length;
        this.mins = new Array(numFeatures).fill(Infinity);
        this.maxs = new Array(numFeatures).fill(-Infinity);

        for (const row of data) {
            for (let i = 0; i < numFeatures; i++) {
                if (row[i] < this.mins[i]) this.mins[i] = row[i];
                if (row[i] > this.maxs[i]) this.maxs[i] = row[i];
            }
        }
    }

    transform(data: number[][]): number[][] {
        if (this.mins.length === 0) return data;
        return data.map(row =>
            row.map((val, i) => {
                const range = this.maxs[i] - this.mins[i];
                return range === 0 ? 0 : (val - this.mins[i]) / range;
            })
        );
    }

    fromJSON(json: any) {
        if (json && json.mins && json.maxs) {
            this.mins = json.mins;
            this.maxs = json.maxs;
        }
    }

    toJSON() {
        return { mins: this.mins, maxs: this.maxs };
    }
}

export class AnomalyDetectionService {
    private forest: any | null = null;
    private isTrained: boolean = false;
    private scaler: SimpleScaler = new SimpleScaler();
    private threshold: number = 0.6; // Default fallback
    private contamination: number = 0.05; // 5% expected anomalies
    private modelPath = path.join(process.cwd(), 'ml_models', 'isolation_forest_v1.json');

    constructor() {
        this.initialize();
    }

    private async initialize() {
        await this.loadModel();
        this.scheduleRetraining();
    }

    private async loadModel() {
        try {
            if (fs.existsSync(this.modelPath)) {
                console.log('📦 Loading persisted Isolation Forest model...');
                const modelData = JSON.parse(fs.readFileSync(this.modelPath, 'utf8'));

                if (modelData.forest && modelData.scaler) {
                    this.scaler.fromJSON(modelData.scaler);
                    this.threshold = modelData.threshold || 0.6;
                    this.forest = this.reconstructForest(modelData.forest, modelData.trainSize);
                    this.isTrained = true;
                    console.log(`✅ Model loaded successfully (Threshold: ${this.threshold.toFixed(4)})`);
                    return;
                }
            }

            console.log('⚠️ No valid persisted model found. Training baseline...');
            await this.trainBaseline();
        } catch (error) {
            console.error('❌ Error loading model:', error);
            await this.trainBaseline();
        }
    }

    /**
     * Reconstruct the Isolation Forest from serialized data.
     * Since TreeNode instances are not exported, we extract the prototype from a dummy instance.
     */
    private reconstructForest(serializedForest: any[], trainSize: number) {
        const dummyForest = new IsolationForest({ nEstimators: 1 });
        dummyForest.train([[0, 0, 0, 0]]);
        const TreeNodeProto = Object.getPrototypeOf(dummyForest.forest[0]);

        const fixNode = (node: any) => {
            if (!node) return;
            Object.setPrototypeOf(node, TreeNodeProto);
            if (node.left) fixNode(node.left);
            if (node.right) fixNode(node.right);
        };

        serializedForest.forEach(fixNode);

        const forest = new IsolationForest({ nEstimators: serializedForest.length });
        forest.forest = serializedForest;
        // @ts-ignore - Isolation Forest uses trainingSet.length in prediction
        forest.trainingSet = { length: trainSize };
        return forest;
    }

    /**
     * Train an Isolation Forest model using historical metrics.
     */
    public async trainBaseline() {
        console.log('🚀 Training Isolation Forest Baseline...');

        const metricsRecs = await prisma.apiMetric.findMany({
            take: 2000,
            orderBy: { timestamp: 'desc' }
        });

        if (metricsRecs.length < 50) {
            console.warn('⚠️ Not enough data to train Isolation Forest. Need at least 50 records.');
            return;
        }

        // Feature Extraction
        const rawData = metricsRecs.map(m => [
            m.latencyMs,
            m.statusCode,
            this.hashString(m.method),
            this.hashString(m.service + m.endpoint)
        ]);

        // 1. Feature Normalization
        this.scaler.fit(rawData);
        const scaledData = this.scaler.transform(rawData);

        // 2. Train Forest
        const forest = new IsolationForest({ nEstimators: 100 });
        forest.train(scaledData);

        // 3. Dynamic Threshold Calculation (based on contamination)
        const scores = forest.predict(scaledData);
        const sortedScores = [...scores].sort((a, b) => a - b);
        const thresholdIndex = Math.floor(sortedScores.length * (1 - this.contamination));
        this.threshold = sortedScores[thresholdIndex];

        this.forest = forest;
        this.isTrained = true;

        // 4. Persistence
        const dir = path.dirname(this.modelPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(this.modelPath, JSON.stringify({
            trainedAt: new Date().toISOString(),
            trainSize: scaledData.length,
            threshold: this.threshold,
            contamination: this.contamination,
            scaler: this.scaler.toJSON(),
            forest: forest.forest // Serialize the trees
        }));

        console.log(`✅ Training complete. Threshold set at ${this.threshold.toFixed(4)} (${scaledData.length} records).`);
    }

    private scheduleRetraining() {
        // Daily retraining
        setInterval(() => this.trainBaseline(), 24 * 60 * 60 * 1000);
    }

    public async detectAnomaly(latencyMs: number, statusCode: number, method: string, endpoint: string): Promise<{ isAnomaly: boolean; score: number }> {
        if (!this.forest || !this.isTrained) return { isAnomaly: false, score: 0 };

        const rawInput = [latencyMs, statusCode, this.hashString(method), this.hashString(endpoint)];
        const scaledInput = this.scaler.transform([rawInput])[0];

        const results = this.forest.predict([scaledInput]);
        const score = results[0];

        return {
            isAnomaly: score > this.threshold,
            score
        };
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 1000;
    }
}

export const anomalyDetector = new AnomalyDetectionService();
