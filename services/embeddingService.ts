import { pipeline, env } from '@xenova/transformers';

// Disable local models, fetch from Hugging Face Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

class EmbeddingService {
    private extractor: any = null;
    private initPromise: Promise<any> | null = null;

    async getInstance() {
        if (this.extractor) return this.extractor;
        if (!this.initPromise) {
            // Using a lightweight multilingual model suitable for Vietnamese
            this.initPromise = pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
        }
        this.extractor = await this.initPromise;
        return this.extractor;
    }

    async embedTextLocal(text: string): Promise<number[]> {
        if (!text || !text.trim()) return [];
        try {
            const extractor = await this.getInstance();
            const output = await extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch (e) {
            console.error("Local Embedding failed", e);
            return [];
        }
    }
}

export const localEmbeddingService = new EmbeddingService();
