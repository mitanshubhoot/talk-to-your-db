import fs from 'fs';
import path from 'path';
import { ExampleRepository } from '../services/exampleRepository';

interface ValidationSummary {
  totalExamples: number;
  categoryCoverage: Record<string, number>;
  complexityDistribution: Record<string, number>;
  patternTypes: Record<string, number>;
  businessContexts: string[];
  qualityMetrics: {
    averageQualityScore: number;
    highQualityExamples: number;
    lowQualityExamples: number;
  };
}

class SimpleExampleValidator {
  
  async validateExampleDataset(): Promise<ValidationSummary> {
    console.log('🔍 Validating Example Dataset...\n');
    
    // Load examples from JSON file
    const examplesPath = path.join(__dirname, '../../data/nl-sql-examples.json');
    
    if (!fs.existsSync(examplesPath)) {
      throw new Error(`Examples file not found at: ${examplesPath}`);
    }
    
    const examplesData = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
    const examples = examplesData.examples;
    
    console.log(`📊 Found ${examples.length} examples to validate`);
    
    // Analyze examples
    const categoryCoverage: Record<string, number> = {};
    const complexityDistribution: Record<string, number> = {};
    const patternTypes: Record<string, number> = {};
    const businessContexts: string[] = [];
    let totalQualityScore = 0;
    let highQualityCount = 0;
    let lowQualityCount = 0;
    
    examples.forEach((example: any) => {
      // Category coverage
      const category = example.category || 'uncategorized';
      categoryCoverage[category] = (categoryCoverage[category] || 0) + 1;
      
      // Complexity distribution
      const complexity = example.queryPattern?.complexity || 'unknown';
      complexityDistribution[complexity] = (complexityDistribution[complexity] || 0) + 1;
      
      // Pattern types
      const patternType = example.queryPattern?.type || 'unknown';
      patternTypes[patternType] = (patternTypes[patternType] || 0) + 1;
      
      // Business contexts
      if (example.businessContext) {
        businessContexts.push(example.businessContext);
      }
      
      // Quality metrics
      const qualityScore = example.qualityScore || 0;
      totalQualityScore += qualityScore;
      
      if (qualityScore >= 90) {
        highQualityCount++;
      } else if (qualityScore < 80) {
        lowQualityCount++;
      }
      
      // Validate example structure
      this.validateExampleStructure(example);
    });
    
    const averageQualityScore = totalQualityScore / examples.length;
    
    const summary: ValidationSummary = {
      totalExamples: examples.length,
      categoryCoverage,
      complexityDistribution,
      patternTypes,
      businessContexts: [...new Set(businessContexts)],
      qualityMetrics: {
        averageQualityScore,
        highQualityExamples: highQualityCount,
        lowQualityExamples: lowQualityCount
      }
    };
    
    this.printValidationResults(summary);
    
    return summary;
  }
  
  private validateExampleStructure(example: any): void {
    const requiredFields = ['id', 'naturalLanguage', 'sql', 'explanation', 'queryPattern'];
    const missingFields = requiredFields.filter(field => !example[field]);
    
    if (missingFields.length > 0) {
      console.log(`⚠️  Example ${example.id || 'unknown'} missing fields: ${missingFields.join(', ')}`);
    }
    
    // Validate SQL structure
    if (example.sql) {
      const sql = example.sql.toLowerCase();
      
      // Check for basic SQL structure
      if (!sql.includes('select')) {
        console.log(`⚠️  Example ${example.id}: SQL doesn't contain SELECT`);
      }
      
      // Check for semicolon
      if (!sql.trim().endsWith(';')) {
        console.log(`⚠️  Example ${example.id}: SQL missing semicolon`);
      }
      
      // Check for potentially problematic patterns
      if (sql.includes('select *') && !example.naturalLanguage.toLowerCase().includes('all')) {
        console.log(`⚠️  Example ${example.id}: Uses SELECT * without 'all' in natural language`);
      }
    }
  }
  
  private printValidationResults(summary: ValidationSummary): void {
    console.log('\n📋 Validation Results:');
    console.log(`   Total Examples: ${summary.totalExamples}`);
    console.log(`   Average Quality Score: ${summary.qualityMetrics.averageQualityScore.toFixed(1)}/100`);
    console.log(`   High Quality (≥90): ${summary.qualityMetrics.highQualityExamples}`);
    console.log(`   Low Quality (<80): ${summary.qualityMetrics.lowQualityExamples}`);
    
    console.log('\n📊 Category Coverage:');
    Object.entries(summary.categoryCoverage).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} examples`);
    });
    
    console.log('\n🔧 Complexity Distribution:');
    Object.entries(summary.complexityDistribution).forEach(([complexity, count]) => {
      console.log(`   ${complexity}: ${count} examples`);
    });
    
    console.log('\n🎯 Pattern Types:');
    Object.entries(summary.patternTypes).forEach(([pattern, count]) => {
      console.log(`   ${pattern}: ${count} examples`);
    });
    
    console.log(`\n🏢 Business Contexts: ${summary.businessContexts.length} unique contexts`);
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    
    if (summary.totalExamples < 25) {
      console.log('   - Consider adding more examples to reach 25-30 total');
    }
    
    if (summary.qualityMetrics.averageQualityScore < 85) {
      console.log('   - Improve overall quality score (target: 85+)');
    }
    
    if (summary.qualityMetrics.lowQualityExamples > summary.totalExamples * 0.1) {
      console.log('   - Review and improve low-quality examples');
    }
    
    if (Object.keys(summary.patternTypes).length < 6) {
      console.log('   - Add more diverse query patterns');
    }
    
    if (summary.businessContexts.length < 8) {
      console.log('   - Add more diverse business contexts');
    }
  }
  
  async testExampleRepository(): Promise<void> {
    console.log('\n🧪 Testing Example Repository Integration...\n');
    
    const repository = new ExampleRepository();
    const stats = repository.getStats();
    
    console.log(`📊 Repository loaded ${stats.totalExamples} examples`);
    console.log(`📊 Average quality: ${stats.averageQuality.toFixed(1)}/100`);
    
    // Test example selection for different query types
    const testQueries = [
      'show me all customers',
      'how many orders do we have',
      'top 5 products by revenue',
      'customers from New York',
      'monthly sales trends'
    ];
    
    testQueries.forEach(query => {
      const examples = repository.selectExamples({
        userQuery: query,
        schemaContext: this.createMockSchema(),
        maxExamples: 3
      });
      
      console.log(`🔍 "${query}": ${examples.length} examples selected`);
      if (examples.length > 0) {
        const avgSimilarity = examples.reduce((sum, ex) => sum + ex.similarityScore, 0) / examples.length;
        console.log(`   Average similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
      }
    });
  }
  
  private createMockSchema() {
    return {
      tables: {
        customers: {
          columns: [
            { table_name: 'customers', column_name: 'customer_id', data_type: 'integer', is_nullable: 'NO', column_default: null, ordinal_position: 1 },
            { table_name: 'customers', column_name: 'name', data_type: 'varchar', is_nullable: 'NO', column_default: null, ordinal_position: 2 }
          ],
          primaryKeys: ['customer_id'],
          foreignKeys: [],
          indexes: []
        },
        orders: {
          columns: [
            { table_name: 'orders', column_name: 'order_id', data_type: 'integer', is_nullable: 'NO', column_default: null, ordinal_position: 1 },
            { table_name: 'orders', column_name: 'customer_id', data_type: 'integer', is_nullable: 'NO', column_default: null, ordinal_position: 2 }
          ],
          primaryKeys: ['order_id'],
          foreignKeys: [],
          indexes: []
        }
      },
      relationships: []
    };
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Simple Example Dataset Validation\n');
  
  const validator = new SimpleExampleValidator();
  
  try {
    await validator.validateExampleDataset();
    await validator.testExampleRepository();
    
    console.log('\n✅ Validation completed successfully!');
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { SimpleExampleValidator };