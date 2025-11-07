import { createLogger, format, transports } from 'winston';
import { SchemaInfo, EnhancedTableInfo } from './database';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface EnhancedSchemaContext {
  relevantTables: EnhancedTableInfo[];
  relationships: RelationshipInfo[];
  columnMappings: ColumnMapping[];
  constraints: ConstraintInfo[];
  sampleData: Record<string, any[]>;
  schemaEmbeddings: SchemaEmbeddings;
  smartTableSelection: SmartTableSelection;
}

export interface RelationshipInfo {
  table: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many';
  strength: number; // 0-1 indicating how strong the relationship is
}

export interface ColumnMapping {
  naturalLanguageTerms: string[];
  columnName: string;
  tableName: string;
  dataType: string;
  semanticType: 'identifier' | 'name' | 'date' | 'amount' | 'category' | 'description' | 'status' | 'flag';
  confidence: number;
  synonyms: string[];
}

export interface ConstraintInfo {
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'not_null';
  tableName: string;
  columnName: string;
  details: any;
}

export interface SchemaEmbeddings {
  tableEmbeddings: Map<string, number[]>;
  columnEmbeddings: Map<string, number[]>;
  semanticSimilarity: Map<string, Map<string, number>>;
}

export interface SmartTableSelection {
  primaryTables: string[];
  secondaryTables: string[];
  suggestedJoins: JoinSuggestion[];
  confidence: number;
}

export interface JoinSuggestion {
  leftTable: string;
  rightTable: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  onCondition: string;
  confidence: number;
  reasoning: string;
}

export class EnhancedSchemaBuilder {
  private semanticMappings: Map<string, string[]> = new Map();
  private columnTypePatterns: Map<string, RegExp[]> = new Map();

  constructor() {
    this.initializeSemanticMappings();
    this.initializeColumnTypePatterns();
  }

  /**
   * Initialize semantic mappings for natural language terms
   */
  private initializeSemanticMappings(): void {
    this.semanticMappings.set('customer', [
      'customer', 'client', 'buyer', 'purchaser', 'user', 'account holder'
    ]);
    this.semanticMappings.set('product', [
      'product', 'item', 'goods', 'merchandise', 'article', 'commodity'
    ]);
    this.semanticMappings.set('order', [
      'order', 'purchase', 'transaction', 'sale', 'booking', 'request'
    ]);
    this.semanticMappings.set('price', [
      'price', 'cost', 'amount', 'value', 'rate', 'fee', 'charge'
    ]);
    this.semanticMappings.set('date', [
      'date', 'time', 'when', 'created', 'updated', 'modified', 'timestamp'
    ]);
    this.semanticMappings.set('name', [
      'name', 'title', 'label', 'description', 'text', 'string'
    ]);
    this.semanticMappings.set('quantity', [
      'quantity', 'amount', 'count', 'number', 'total', 'sum'
    ]);
    this.semanticMappings.set('status', [
      'status', 'state', 'condition', 'flag', 'active', 'enabled'
    ]);
  }

  /**
   * Initialize column type recognition patterns
   */
  private initializeColumnTypePatterns(): void {
    this.columnTypePatterns.set('identifier', [
      /^(id|.*_id)$/i,
      /^(uuid|guid)$/i,
      /^.*_key$/i
    ]);
    
    this.columnTypePatterns.set('name', [
      /^(name|title|label)$/i,
      /^.*_name$/i,
      /^.*_title$/i
    ]);
    
    this.columnTypePatterns.set('date', [
      /^.*_(date|time|at)$/i,
      /^(created|updated|modified|deleted)_.*$/i,
      /^(start|end)_.*$/i
    ]);
    
    this.columnTypePatterns.set('amount', [
      /^(price|cost|amount|value|total|sum)$/i,
      /^.*_(price|cost|amount|value|total|sum)$/i,
      /^(revenue|sales|income)$/i
    ]);
    
    this.columnTypePatterns.set('category', [
      /^(category|type|kind|class)$/i,
      /^.*_(category|type|kind|class)$/i,
      /^(status|state|condition)$/i
    ]);
    
    this.columnTypePatterns.set('description', [
      /^(description|details|notes|comments)$/i,
      /^.*_(description|details|notes|comments)$/i
    ]);
    
    this.columnTypePatterns.set('flag', [
      /^(is_|has_|can_|should_).*$/i,
      /^.*(active|enabled|deleted|archived)$/i
    ]);
  }

  /**
   * Build enhanced schema context for better SQL generation
   */
  async buildContext(connectionId: string, query: string, schema: SchemaInfo): Promise<EnhancedSchemaContext> {
    logger.debug(`Building enhanced schema context for query: "${query}"`);

    // Smart table selection based on query keywords
    const smartTableSelection = this.performSmartTableSelection(query, schema);
    
    // Get relevant tables based on selection
    const relevantTables = this.getRelevantTables(smartTableSelection.primaryTables, schema);
    
    // Enhanced relationship analysis
    const relationships = this.analyzeRelationships(schema, smartTableSelection.primaryTables);
    
    // Column mappings with semantic understanding
    const columnMappings = this.createColumnMappings(query, schema, smartTableSelection.primaryTables);
    
    // Constraint analysis
    const constraints = this.analyzeConstraints(schema, smartTableSelection.primaryTables);
    
    // Sample data for context (limited for performance)
    const sampleData = await this.getSampleData(schema, smartTableSelection.primaryTables);
    
    // Schema embeddings for semantic similarity
    const schemaEmbeddings = this.createSchemaEmbeddings(schema, smartTableSelection.primaryTables);

    const context: EnhancedSchemaContext = {
      relevantTables,
      relationships,
      columnMappings,
      constraints,
      sampleData,
      schemaEmbeddings,
      smartTableSelection
    };

    logger.debug(`Enhanced schema context built with ${relevantTables.length} tables and ${relationships.length} relationships`);

    return context;
  }

  /**
   * Perform smart table selection based on query keywords
   */
  private performSmartTableSelection(query: string, schema: SchemaInfo): SmartTableSelection {
    const lowerQuery = query.toLowerCase();
    const tableScores = new Map<string, number>();
    const tableReasons = new Map<string, string[]>();

    // Score each table based on relevance to the query
    Object.keys(schema.tables).forEach(tableName => {
      let score = 0;
      const reasons: string[] = [];

      // Direct table name matching
      const tableWords = tableName.toLowerCase().split('_');
      const singularForms = tableWords.map(word => {
        if (word.endsWith('s') && word.length > 3) {
          return word.slice(0, -1);
        }
        return word;
      });

      // Check for direct mentions
      if (tableWords.some(word => lowerQuery.includes(word))) {
        score += 50;
        reasons.push('Direct table name match');
      }
      
      if (singularForms.some(word => lowerQuery.includes(word))) {
        score += 45;
        reasons.push('Singular form match');
      }

      // Semantic matching using mappings
      this.semanticMappings.forEach((synonyms, concept) => {
        if (synonyms.some(synonym => lowerQuery.includes(synonym))) {
          if (tableName.toLowerCase().includes(concept)) {
            score += 30;
            reasons.push(`Semantic match: ${concept}`);
          }
        }
      });

      // Column name relevance
      const tableInfo = schema.tables[tableName];
      tableInfo.columns.forEach(column => {
        const columnName = column.column_name.toLowerCase();
        if (lowerQuery.includes(columnName)) {
          score += 20;
          reasons.push(`Column match: ${columnName}`);
        }

        // Check semantic types
        const semanticType = this.determineSemanticType(column.column_name, column.data_type);
        this.semanticMappings.forEach((synonyms, concept) => {
          if (synonyms.some(synonym => lowerQuery.includes(synonym))) {
            if (semanticType === concept) {
              score += 15;
              reasons.push(`Column semantic match: ${concept}`);
            }
          }
        });
      });

      // Boost score for tables with relationships to other relevant tables
      if (schema.relationships) {
        const relatedTables = schema.relationships
          .filter(rel => rel.table === tableName || rel.referencedTable === tableName)
          .map(rel => rel.table === tableName ? rel.referencedTable : rel.table);
        
        relatedTables.forEach(relatedTable => {
          if (tableScores.has(relatedTable) && tableScores.get(relatedTable)! > 20) {
            score += 10;
            reasons.push(`Related to relevant table: ${relatedTable}`);
          }
        });
      }

      if (score > 0) {
        tableScores.set(tableName, score);
        tableReasons.set(tableName, reasons);
      }
    });

    // Sort tables by score
    const sortedTables = Array.from(tableScores.entries())
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

    // Determine primary and secondary tables
    const primaryTables = sortedTables
      .filter(([, score]) => score >= 30)
      .map(([table]) => table);
    
    const secondaryTables = sortedTables
      .filter(([, score]) => score >= 15 && score < 30)
      .map(([table]) => table);

    // Generate join suggestions
    const suggestedJoins = this.generateJoinSuggestions(primaryTables, schema);

    // Calculate overall confidence
    const maxScore = Math.max(...Array.from(tableScores.values()));
    const confidence = Math.min(maxScore / 50, 1) * 100;

    logger.debug(`Smart table selection: ${primaryTables.length} primary, ${secondaryTables.length} secondary tables`);

    return {
      primaryTables: primaryTables.slice(0, 5), // Limit to top 5
      secondaryTables: secondaryTables.slice(0, 3), // Limit to top 3
      suggestedJoins,
      confidence
    };
  }

  /**
   * Generate intelligent JOIN suggestions
   */
  private generateJoinSuggestions(tables: string[], schema: SchemaInfo): JoinSuggestion[] {
    const suggestions: JoinSuggestion[] = [];
    
    if (!schema.relationships || tables.length < 2) {
      return suggestions;
    }

    // Find relationships between selected tables
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const table1 = tables[i];
        const table2 = tables[j];

        // Find direct relationships
        const directRel = schema.relationships.find(rel => 
          (rel.table === table1 && rel.referencedTable === table2) ||
          (rel.table === table2 && rel.referencedTable === table1)
        );

        if (directRel) {
          const isLeftToRight = directRel.table === table1;
          const leftTable = isLeftToRight ? table1 : table2;
          const rightTable = isLeftToRight ? table2 : table1;
          const leftColumn = isLeftToRight ? directRel.column : directRel.referencedColumn;
          const rightColumn = isLeftToRight ? directRel.referencedColumn : directRel.column;

          suggestions.push({
            leftTable,
            rightTable,
            joinType: 'INNER',
            onCondition: `${leftTable}.${leftColumn} = ${rightTable}.${rightColumn}`,
            confidence: 90,
            reasoning: 'Direct foreign key relationship'
          });
        }
      }
    }

    // Find indirect relationships (through junction tables)
    // This is a simplified version - could be enhanced for complex many-to-many relationships
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get relevant table information
   */
  private getRelevantTables(tableNames: string[], schema: SchemaInfo): EnhancedTableInfo[] {
    return tableNames
      .map(tableName => schema.tables[tableName])
      .filter(Boolean);
  }

  /**
   * Analyze relationships with enhanced information
   */
  private analyzeRelationships(schema: SchemaInfo, relevantTables: string[]): RelationshipInfo[] {
    if (!schema.relationships) return [];

    return schema.relationships
      .filter(rel => 
        relevantTables.includes(rel.table) || relevantTables.includes(rel.referencedTable)
      )
      .map(rel => ({
        table: rel.table,
        column: rel.column,
        referencedTable: rel.referencedTable,
        referencedColumn: rel.referencedColumn,
        relationshipType: this.determineRelationshipType(rel, schema),
        strength: this.calculateRelationshipStrength(rel, schema)
      }));
  }

  /**
   * Determine relationship type (one-to-one, one-to-many, etc.)
   */
  private determineRelationshipType(rel: any, schema: SchemaInfo): 'one-to-one' | 'one-to-many' | 'many-to-many' {
    // This is a simplified implementation
    // In a real system, you'd analyze the actual data or constraints
    
    const referencingTable = schema.tables[rel.table];
    const referencedTable = schema.tables[rel.referencedTable];
    
    if (!referencingTable || !referencedTable) return 'one-to-many';

    // Check if the foreign key column is unique (indicates one-to-one)
    const fkColumn = referencingTable.columns.find(col => col.column_name === rel.column);
    if (fkColumn && referencingTable.indexes?.some(idx => 
      idx.isUnique && idx.columns.includes(rel.column)
    )) {
      return 'one-to-one';
    }

    // Default to one-to-many
    return 'one-to-many';
  }

  /**
   * Calculate relationship strength (0-1)
   */
  private calculateRelationshipStrength(rel: any, schema: SchemaInfo): number {
    let strength = 0.5; // Base strength

    // Boost for primary key relationships
    const referencedTable = schema.tables[rel.referencedTable];
    if (referencedTable?.primaryKeys?.includes(rel.referencedColumn)) {
      strength += 0.3;
    }

    // Boost for NOT NULL foreign keys
    const referencingTable = schema.tables[rel.table];
    const fkColumn = referencingTable?.columns.find(col => col.column_name === rel.column);
    if (fkColumn?.is_nullable === 'NO') {
      strength += 0.2;
    }

    return Math.min(strength, 1.0);
  }

  /**
   * Create column mappings with semantic understanding
   */
  private createColumnMappings(query: string, schema: SchemaInfo, relevantTables: string[]): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];
    const lowerQuery = query.toLowerCase();

    relevantTables.forEach(tableName => {
      const tableInfo = schema.tables[tableName];
      if (!tableInfo) return;

      tableInfo.columns.forEach(column => {
        const semanticType = this.determineSemanticType(column.column_name, column.data_type);
        const naturalLanguageTerms = this.generateNaturalLanguageTerms(column.column_name, semanticType);
        const synonyms = this.getSynonyms(column.column_name, semanticType);
        
        // Calculate confidence based on query relevance
        const confidence = this.calculateColumnRelevance(lowerQuery, column.column_name, naturalLanguageTerms, synonyms);

        if (confidence > 0.1) { // Only include relevant columns
          mappings.push({
            naturalLanguageTerms,
            columnName: column.column_name,
            tableName,
            dataType: column.data_type,
            semanticType,
            confidence,
            synonyms
          });
        }
      });
    });

    return mappings.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Determine semantic type of a column
   */
  private determineSemanticType(columnName: string, dataType: string): ColumnMapping['semanticType'] {
    const lowerColumnName = columnName.toLowerCase();
    const lowerDataType = dataType.toLowerCase();

    // Check patterns
    for (const [type, patterns] of this.columnTypePatterns.entries()) {
      if (patterns.some(pattern => pattern.test(lowerColumnName))) {
        return type as ColumnMapping['semanticType'];
      }
    }

    // Check data type
    if (lowerDataType.includes('date') || lowerDataType.includes('time') || lowerDataType.includes('timestamp')) {
      return 'date';
    }
    if (lowerDataType.includes('numeric') || lowerDataType.includes('decimal') || lowerDataType.includes('money')) {
      return 'amount';
    }
    if (lowerDataType.includes('boolean') || lowerDataType.includes('bit')) {
      return 'flag';
    }
    if (lowerDataType.includes('text') || lowerDataType.includes('varchar') || lowerDataType.includes('char')) {
      if (lowerColumnName.includes('name') || lowerColumnName.includes('title')) {
        return 'name';
      }
      if (lowerColumnName.includes('description') || lowerColumnName.includes('note')) {
        return 'description';
      }
      return 'category';
    }

    return 'identifier'; // Default
  }

  /**
   * Generate natural language terms for a column
   */
  private generateNaturalLanguageTerms(columnName: string, semanticType: ColumnMapping['semanticType']): string[] {
    const terms: string[] = [];
    
    // Add the column name itself
    terms.push(columnName);
    
    // Add variations
    const cleanName = columnName.replace(/_/g, ' ').toLowerCase();
    terms.push(cleanName);
    
    // Add semantic type synonyms
    const semanticSynonyms = this.semanticMappings.get(semanticType);
    if (semanticSynonyms) {
      terms.push(...semanticSynonyms);
    }

    // Add specific variations based on column name patterns
    if (columnName.endsWith('_id')) {
      const baseName = columnName.replace('_id', '');
      terms.push(baseName, `${baseName} id`, `${baseName} identifier`);
    }
    
    if (columnName.startsWith('is_') || columnName.startsWith('has_')) {
      const baseName = columnName.substring(3);
      terms.push(baseName, `is ${baseName}`, `has ${baseName}`);
    }

    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Get synonyms for a column based on its name and semantic type
   */
  private getSynonyms(columnName: string, semanticType: ColumnMapping['semanticType']): string[] {
    const synonyms: string[] = [];
    
    // Get semantic synonyms
    const semanticSynonyms = this.semanticMappings.get(semanticType);
    if (semanticSynonyms) {
      synonyms.push(...semanticSynonyms);
    }

    // Add specific synonyms based on common column names
    const commonSynonyms: Record<string, string[]> = {
      'email': ['email address', 'e-mail', 'mail'],
      'phone': ['phone number', 'telephone', 'mobile'],
      'address': ['location', 'street address', 'postal address'],
      'created_at': ['creation date', 'created on', 'date created'],
      'updated_at': ['modification date', 'last updated', 'modified on'],
      'total_amount': ['total', 'sum', 'grand total', 'amount'],
      'first_name': ['given name', 'forename'],
      'last_name': ['surname', 'family name']
    };

    const lowerColumnName = columnName.toLowerCase();
    Object.entries(commonSynonyms).forEach(([key, syns]) => {
      if (lowerColumnName.includes(key) || key.includes(lowerColumnName)) {
        synonyms.push(...syns);
      }
    });

    return [...new Set(synonyms)]; // Remove duplicates
  }

  /**
   * Calculate column relevance to the query
   */
  private calculateColumnRelevance(
    query: string, 
    columnName: string, 
    naturalLanguageTerms: string[], 
    synonyms: string[]
  ): number {
    let relevance = 0;

    // Direct column name match
    if (query.includes(columnName.toLowerCase())) {
      relevance += 0.8;
    }

    // Natural language terms match
    naturalLanguageTerms.forEach(term => {
      if (query.includes(term.toLowerCase())) {
        relevance += 0.6;
      }
    });

    // Synonyms match
    synonyms.forEach(synonym => {
      if (query.includes(synonym.toLowerCase())) {
        relevance += 0.4;
      }
    });

    // Partial matches
    const queryWords = query.split(/\s+/);
    const columnWords = columnName.toLowerCase().split('_');
    
    queryWords.forEach(queryWord => {
      columnWords.forEach(columnWord => {
        if (queryWord.includes(columnWord) || columnWord.includes(queryWord)) {
          relevance += 0.2;
        }
      });
    });

    return Math.min(relevance, 1.0);
  }

  /**
   * Analyze constraints for the relevant tables
   */
  private analyzeConstraints(schema: SchemaInfo, relevantTables: string[]): ConstraintInfo[] {
    const constraints: ConstraintInfo[] = [];

    relevantTables.forEach(tableName => {
      const tableInfo = schema.tables[tableName];
      if (!tableInfo) return;

      // Primary key constraints
      tableInfo.primaryKeys?.forEach(pkColumn => {
        constraints.push({
          type: 'primary_key',
          tableName,
          columnName: pkColumn,
          details: { isPrimaryKey: true }
        });
      });

      // Foreign key constraints
      tableInfo.foreignKeys?.forEach(fk => {
        constraints.push({
          type: 'foreign_key',
          tableName,
          columnName: fk.column,
          details: {
            referencedTable: fk.referencedTable,
            referencedColumn: fk.referencedColumn
          }
        });
      });

      // Column-level constraints
      tableInfo.columns.forEach(column => {
        if (column.is_nullable === 'NO') {
          constraints.push({
            type: 'not_null',
            tableName,
            columnName: column.column_name,
            details: { nullable: false }
          });
        }
      });

      // Unique constraints from indexes
      tableInfo.indexes?.forEach(index => {
        if (index.isUnique) {
          index.columns.forEach(column => {
            constraints.push({
              type: 'unique',
              tableName,
              columnName: column,
              details: { indexName: index.name }
            });
          });
        }
      });
    });

    return constraints;
  }

  /**
   * Get sample data for context (limited for performance)
   */
  private async getSampleData(schema: SchemaInfo, relevantTables: string[]): Promise<Record<string, any[]>> {
    const sampleData: Record<string, any[]> = {};

    // This is a placeholder implementation
    // In a real system, you'd query the database for sample data
    relevantTables.forEach(tableName => {
      const tableInfo = schema.tables[tableName];
      if (tableInfo && tableInfo.rowCount && tableInfo.rowCount > 0) {
        // Generate mock sample data based on column types
        const samples: any[] = [];
        const sampleCount = Math.min(3, tableInfo.rowCount); // Limit to 3 samples
        
        for (let i = 0; i < sampleCount; i++) {
          const sample: any = {};
          tableInfo.columns.slice(0, 5).forEach(column => { // Limit to first 5 columns
            sample[column.column_name] = this.generateSampleValue(column);
          });
          samples.push(sample);
        }
        
        sampleData[tableName] = samples;
      }
    });

    return sampleData;
  }

  /**
   * Generate sample value based on column type
   */
  private generateSampleValue(column: any): any {
    const dataType = column.data_type.toLowerCase();
    const columnName = column.column_name.toLowerCase();

    if (dataType.includes('int') || dataType.includes('numeric')) {
      if (columnName.includes('id')) return Math.floor(Math.random() * 1000) + 1;
      if (columnName.includes('price') || columnName.includes('amount')) return Math.floor(Math.random() * 10000) / 100;
      return Math.floor(Math.random() * 100);
    }
    
    if (dataType.includes('varchar') || dataType.includes('text')) {
      if (columnName.includes('name')) return 'Sample Name';
      if (columnName.includes('email')) return 'sample@example.com';
      if (columnName.includes('city')) return 'Sample City';
      return 'Sample Text';
    }
    
    if (dataType.includes('date') || dataType.includes('timestamp')) {
      return new Date().toISOString().split('T')[0];
    }
    
    if (dataType.includes('boolean')) {
      return Math.random() > 0.5;
    }

    return 'Sample Value';
  }

  /**
   * Create schema embeddings for semantic similarity
   */
  private createSchemaEmbeddings(schema: SchemaInfo, relevantTables: string[]): SchemaEmbeddings {
    // This is a simplified implementation
    // In a real system, you'd use actual embedding models
    
    const tableEmbeddings = new Map<string, number[]>();
    const columnEmbeddings = new Map<string, number[]>();
    const semanticSimilarity = new Map<string, Map<string, number>>();

    relevantTables.forEach(tableName => {
      // Generate simple embeddings based on table and column names
      const tableEmbedding = this.generateSimpleEmbedding(tableName);
      tableEmbeddings.set(tableName, tableEmbedding);

      const tableInfo = schema.tables[tableName];
      if (tableInfo) {
        tableInfo.columns.forEach(column => {
          const columnKey = `${tableName}.${column.column_name}`;
          const columnEmbedding = this.generateSimpleEmbedding(column.column_name);
          columnEmbeddings.set(columnKey, columnEmbedding);
        });
      }
    });

    // Calculate semantic similarity between tables and columns
    relevantTables.forEach(table1 => {
      const similarities = new Map<string, number>();
      relevantTables.forEach(table2 => {
        if (table1 !== table2) {
          const similarity = this.calculateCosineSimilarity(
            tableEmbeddings.get(table1)!,
            tableEmbeddings.get(table2)!
          );
          similarities.set(table2, similarity);
        }
      });
      semanticSimilarity.set(table1, similarities);
    });

    return {
      tableEmbeddings,
      columnEmbeddings,
      semanticSimilarity
    };
  }

  /**
   * Generate simple embedding based on string (placeholder implementation)
   */
  private generateSimpleEmbedding(text: string): number[] {
    // This is a very simplified embedding generation
    // In a real system, you'd use proper embedding models like Word2Vec, BERT, etc.
    
    const embedding = new Array(50).fill(0); // 50-dimensional embedding
    const chars = text.toLowerCase();
    
    for (let i = 0; i < chars.length; i++) {
      const charCode = chars.charCodeAt(i);
      const index = charCode % 50;
      embedding[index] += 1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) return 0;
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }
}

// Export singleton instance
export const enhancedSchemaBuilder = new EnhancedSchemaBuilder();