
import Dexie, { Table } from 'dexie';
import { GameSession, Turn, RegistryEntry, GalleryImage, GameEvent } from './types';

class GameDatabase extends Dexie {
  sessions!: Table<GameSession>;
  turns!: Table<Turn>;
  encyclopedia!: Table<RegistryEntry>;
  imageGallery!: Table<GalleryImage>;
  events!: Table<GameEvent>;

  constructor() {
    super('ThienDaoDB');
    (this as any).version(6).stores({
      sessions: '++id, createdAt',
      turns: '++id, sessionId, turnIndex, [sessionId+turnIndex]',
      encyclopedia: '++id, sessionId, type, name, [sessionId+name]',
      imageGallery: '++id, addedAt',
      events: '++id, sessionId, status, triggerTimestamp'
    });
  }

  /**
   * Optimized batch import for restoring game sessions.
   * Runs inside a single transaction for ACID compliance and speed.
   */
  async importSession(session: GameSession, turns: Turn[], wiki: RegistryEntry[] = [], gallery: GalleryImage[] = []): Promise<number> {
      return (this as any).transaction('rw', this.sessions, this.turns, this.encyclopedia, this.imageGallery, async () => {
          // 1. Add Session
          const newSessionId = await this.sessions.add({ 
              ...session, 
              id: undefined, 
              createdAt: Date.now() 
          }) as number;

          // 2. Prepare Turns (Update sessionId)
          const turnsWithId = turns.map(t => ({ 
              ...t, 
              id: undefined, 
              sessionId: newSessionId 
          }));
          
          // Bulk Add Turns
          if (turnsWithId.length > 0) {
              await this.turns.bulkAdd(turnsWithId);
          }

          // 3. Prepare Wiki (Update sessionId)
          if (wiki && wiki.length > 0) {
              const wikiWithId = wiki.map(e => ({ 
                  ...e, 
                  id: undefined, 
                  sessionId: newSessionId 
          }));
              await this.encyclopedia.bulkAdd(wikiWithId);
          }

          // 4. Import Gallery (Global check for duplicates based on URL)
          if (gallery && gallery.length > 0) {
              const existingImages = await this.imageGallery.toArray();
              const existingUrls = new Set(existingImages.map(img => img.url));
              
              const imagesToAdd = gallery
                  .filter(img => img.url && !existingUrls.has(img.url))
                  .map(({ id, ...rest }) => ({
                      ...rest,
                      addedAt: Date.now() // Reset time to now so they appear at top or valid sort
                  }));

              if (imagesToAdd.length > 0) {
                  await this.imageGallery.bulkAdd(imagesToAdd);
              }
          }

          return newSessionId;
      });
  }

  /**
   * Helper to clean Wiki Names (remove common AI prefixes)
   */
  private normalizeWikiName(name: string): string {
      return name
          .replace(/^(Thiên Phú|Kỹ Năng|Căn Cơ|Ngoại Hình|Tính Cách|NPC|Địa Danh|Vật Phẩm|Skill|Item|Location|Faction)[:\s\-]+/gi, '')
          .replace(/\(.*\)/g, '') // Remove parentheses content e.g. "Mai Dora (Mai)" -> "Mai Dora"
          .trim();
  }

  /**
   * Calculate Jaccard Similarity (Word Overlap) to detect duplicates.
   * Returns 0 to 1 (1 = identical).
   */
  private calculateSimilarity(text1: string, text2: string): number {
      if (!text1 || !text2) return 0;
      const set1 = new Set(text1.toLowerCase().split(/\s+/));
      const set2 = new Set(text2.toLowerCase().split(/\s+/));
      
      const intersection = new Set([...set1].filter(word => set2.has(word)));
      const union = new Set([...set1, ...set2]);
      
      return intersection.size / union.size;
  }

  /**
   * Optimized Wiki Update Logic (Fixed for Redundancy & Name Updates):
   * 1. Deduplicates input candidates.
   * 2. Fuzzy Name Matching (Contains/Included) + Same Type check.
   * 3. Prevents appending redundant descriptions.
   */
  async upsertWikiEntries(sessionId: number, candidates: RegistryEntry[], currentTurnIndex: number): Promise<void> {
      if (!candidates || candidates.length === 0) return;

      return (this as any).transaction('rw', this.encyclopedia, async () => {
          // 1. Deduplicate candidates internally
          const uniqueCandidates = new Map<string, RegistryEntry>();
          candidates.forEach(c => {
              if (c.name && c.name.trim()) {
                  // Normalize for internal map key
                  const cleanName = this.normalizeWikiName(c.name).toLowerCase();
                  if (!uniqueCandidates.has(cleanName)) {
                      uniqueCandidates.set(cleanName, c);
                  }
              }
          });

          // Fetch all existing entries for this session
          const existingEntries = await this.encyclopedia
              .where('sessionId')
              .equals(sessionId)
              .toArray();

          const entriesToPut: RegistryEntry[] = [];

          for (const newEntry of uniqueCandidates.values()) {
              const rawNewName = newEntry.name.trim();
              const cleanNewName = this.normalizeWikiName(rawNewName).toLowerCase();
              
              // SMART MATCHING STRATEGY
              const existing = existingEntries.find(e => {
                  const rawExistingName = e.name.trim();
                  const cleanExistingName = this.normalizeWikiName(rawExistingName).toLowerCase();

                  // 1. Exact Clean Match
                  if (cleanExistingName === cleanNewName) return true;

                  // 2. Fuzzy Containment (Only if length > 3 to avoid 'An' matching 'Thanh')
                  if (cleanExistingName.length > 3 && cleanNewName.length > 3) {
                      if (cleanExistingName.includes(cleanNewName) || cleanNewName.includes(cleanExistingName)) {
                          return true;
                      }
                  }
                  return false;
              });

              if (existing) {
                  // UPDATE EXISTING
                  let finalDescription = existing.description || "";
                  const newDesc = newEntry.description?.trim();
                  let hasChanged = false;

                  if (newDesc && newDesc.length > 0) {
                       // STRATEGY 1: IF NEW DESCRIPTION IS SIGNIFICANTLY LONGER -> UPGRADE (REPLACE)
                       // Modified: Increased threshold to 1.5 to only allow major upgrades, preventing small changes.
                       if (newDesc.length > finalDescription.length * 1.5) { 
                           finalDescription = newDesc;
                           hasChanged = true;
                       } 
                       // STRATEGY 2: DISABLE APPENDING (Per User Request)
                       // We no longer append "• [Cập nhật]" to prevent bloating the context window.
                       // Unless it's a replacement (above), we stick to the old description.
                  }

                  // Check other fields for updates
                  if (newEntry.status && newEntry.status !== existing.status) hasChanged = true;
                  
                  // Update appearance only if new one is longer/better
                  if (newEntry.appearance && newEntry.appearance.length > (existing.appearance?.length || 0)) {
                      existing.appearance = newEntry.appearance;
                      hasChanged = true;
                  }
                  
                  // Name Update: Always prefer the LONGER name
                  let finalName = existing.name;
                  if (rawNewName.length > finalName.length) {
                      finalName = rawNewName;
                      hasChanged = true;
                  }

                  if (hasChanged) {
                      entriesToPut.push({
                          ...existing,
                          name: finalName, 
                          description: finalDescription,
                          embedding: (newEntry.embedding && newEntry.embedding.length > 0) ? newEntry.embedding : existing.embedding,
                          status: newEntry.status || existing.status,
                          powerLevel: newEntry.powerLevel || existing.powerLevel,
                          affiliation: newEntry.affiliation || existing.affiliation,
                          appearance: newEntry.appearance || existing.appearance,
                          personality: newEntry.personality || existing.personality,
                          secrets: newEntry.secrets || existing.secrets,
                          type: existing.type || newEntry.type,
                          lastUpdatedTurn: currentTurnIndex
                      });
                  }

              } else {
                  // INSERT NEW
                  entriesToPut.push({
                      ...newEntry,
                      name: newEntry.name.trim(),
                      sessionId: sessionId,
                      firstSeenTurn: currentTurnIndex,
                      lastUpdatedTurn: currentTurnIndex
                  });
              }
          }

          if (entriesToPut.length > 0) {
              await this.encyclopedia.bulkPut(entriesToPut);
          }
      });
  }
}

export const db = new GameDatabase();

// --- Vector Math Helpers for Client-Side RAG ---

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
      return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0; 
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function findRelevantContext(
  sessionId: number, 
  queryVector: number[], 
  maxTurnIndex: number,
  topK: number = 5,
  minScore: number = 0.65 
): Promise<{ turn: Turn; score: number }[]> {
  if (!queryVector || queryVector.length === 0) return [];

  const allTurns = await db.turns
    .where('sessionId')
    .equals(sessionId)
    .filter(turn => 
      !!turn.embedding && 
      !!turn.narrative && 
      turn.turnIndex < maxTurnIndex
    )
    .toArray();

  if (allTurns.length === 0) return [];

  const scoredTurns = allTurns.map(turn => ({
    turn,
    score: cosineSimilarity(queryVector, turn.embedding!)
  }));

  const filteredTurns = scoredTurns
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return filteredTurns.slice(0, topK);
}

export async function findRelevantWiki(
    sessionId: number, 
    queryVector: number[], 
    text: string, 
    topK: number = 4, 
    minScore: number = 0.65
): Promise<RegistryEntry[]> {
    
    const allEntries = await db.encyclopedia
        .where('sessionId')
        .equals(sessionId)
        .toArray();
    
    if (allEntries.length === 0) return [];

    const lowerText = text.toLowerCase();
    
    const keywordMatches: RegistryEntry[] = [];
    const keywordIds = new Set<number>();

    allEntries.forEach(entry => {
        if (lowerText.includes(entry.name.toLowerCase())) {
            keywordMatches.push(entry);
            if (entry.id) keywordIds.add(entry.id);
        }
    });

    let vectorMatches: { entry: RegistryEntry; score: number }[] = [];
    if (queryVector && queryVector.length > 0) {
        vectorMatches = allEntries
            .filter(e => !!e.embedding && !keywordIds.has(e.id!)) 
            .map(entry => ({
                entry,
                score: cosineSimilarity(queryVector, entry.embedding!)
            }))
            .filter(item => item.score >= minScore)
            .sort((a, b) => b.score - a.score);
    }

    const finalResults = [...keywordMatches];
    
    for (const match of vectorMatches) {
        if (finalResults.length >= topK + 2) break; 
        finalResults.push(match.entry);
    }

    return finalResults;
}
