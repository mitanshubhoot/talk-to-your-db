import fs from 'fs';
import path from 'path';
import { ExampleRepository, NLSQLExample } from '../services/exampleRepository';
import { QueryValidator } from '../services/queryValidator';
import { SchemaInfo } from '../services/database';

interface ValidationResult {
  exampleId: string;
  naturalLanguage: string;
  sql: string;
  isValid: boolean;
  syntaxErrors: string[];
  qualityIssues: string[];
  recommendations: string[];
  businessRelevance: number;
  technicalQuality: number;
  overallScore: number;
}

interface DatasetValidationReport {
  totalExamples: number;
  validExamples: number;
  invalidExamples: number;
  averageQuality: number;
  categoryDistribution: Record<string, number>;
  complexityDistribution: Record<string, number>;
  patternCoverage: Record<string, number>;
  businessContextCoverage: string[];
  recommendations: string[];
  results: ValidationResult[];
}

class ExampleDatasetValidator {
  private queryValidator: QueryValidator;
  private exampleRepository: ExampleRepository;

  constructor() {
    this.queryValidator = new QueryValidator();
    this.exampleRepository = new ExampleRepository();
  }

  /**
   * Load and validate the curated example dataset
   */
  async validateDataset(): Promise<DatasetValidationReport> {
    console.log('🔍 Loading example dataset...');
    
    // Load examples from JSON file
    const examplesPath = path.join(__dirname, '../../data/nl-sql-examples.json');
    const examplesData = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
    
    console.log(`📊 Found ${examplesData.examples.length} examples to validate`);
    
    const results: ValidationResult[] = [];
    const mockSchema = this.createMockSchema();

    // Validate each example
    for (const example of examplesData.examples) {
      console.log(`\n🔍 Validating: ${example.id} - "${example.naturalLanguage}"`);
      
      const result = await this.validateExample(example, mockSchema);
      results.push(result);
      
      // Log validation result
      const status = result.isValid ? '✅' : '❌';
      console.log(`${status} ${result.exampleId}: Score ${result.overallScore}/100`);
      
      if (!result.isValid) {
        console.log(`   Errors: ${result.syntaxErrors.join(', ')}`);
      }
      if (result.qualityIssues.length > 0) {
        console.log(`   Issues: ${result.qualityIssues.join(', ')}`);
      }
    }

    // Generate comprehensive report
    const report = this.generateValidationReport(results, examplesData);
    
    console.log('\n📋 Validation Summary:');
    console.log(`   Total Examples: ${report.totalExamples}`);
    console.log(`   Valid Examples: ${report.validExamples} (${((report.validExamples/report.totalExamples)*100).toFixed(1)}%)`);
    console.log(`   Average Quality: ${report.averageQuality.toFixed(1)}/100`);
    console.log(`   Pattern Coverage: ${Object.keys(report.patternCoverage).length} patterns`);
    
    return report;
  }

  /**
   * Validate a single example
   */
  private async validateExample(example: any, schema: SchemaInfo): Promise<ValidationResult> {
    const result: ValidationResult = {
      exampleId: example.id,
      naturalLanguage: example.naturalLanguage,
      sql: example.sql,
      isValid: true,
      syntaxErrors: [],
      qualityIssues: [],
      recommendations: [],
      businessRelevance: 0,
      technicalQuality: 0,
      overallScore: 0
    };

    // 1. Syntax Validation
    try {
      const syntaxValidation = await this.queryValidator.validateSQL(example.sql, schema);
      if (!syntaxValidation.isValid) {
        result.isValid = false;
        result.syntaxErrors = syntaxValidation.errors || [];
      }
    } catch (error) {
      result.isValid = false;
      result.syntaxErrors.push(`Validation error: ${error}`);
    }

    // 2. Technical Quality Assessment
    result.technicalQuality = this.assessTechnicalQuality(example);

    // 3. Business Relevance Assessment
    result.businessRelevance = this.assessBusinessRelevance(example);

    // 4. Quality Issues Detection
    result.qualityIssues = this.detectQualityIssues(example);

    // 5. Generate Recommendations
    result.recommendations = this.generateRecommendations(example, result);

    // 6. Calculate Overall Score
    result.overallScore = this.calculateOverallScore(result);

    return result;
  }

  /**
   * Assess technical quality of SQL and example structure
   */
  private assessTechnicalQuality(example: any): number {
    let score = 100;
    const sql = example.sql.toLowerCase();

    // Check for best practices
    if (!sql.includes('limit') && (sql.includes('select *') || sql.includes('select '))) {
      score -= 10; // Missing LIMIT for potentially large results
    }

    if (sql.includes('select *')) {
      score -= 5; // Using SELECT * instead of specific columns
    }

    if (sql.includes('join') && !sql.includes(' on ')) {
      score -= 15; // JOIN without proper ON condition
    }

    if (sql.includes('group by') && !this.hasAggregateFunction(sql)) {
      score -= 10; // GROUP BY without aggregate function
    }

    if (!sql.endsWith(';')) {
      score -= 5; // Missing semicolon
    }

    // Check for good practices
    if (sql.includes('order by')) {
      score += 5; // Good: includes ordering
    }

    if (this.hasTableAliases(sql)) {
      score += 5; // Good: uses table aliases
    }

    if (sql.includes('coalesce') || sql.includes('nullif')) {
      score += 5; // Good: handles NULL values
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess business relevance and usefulness
   */
  private assessBusinessRelevance(example: any): number {
    let score = 70; // Base score

    const nl = example.naturalLanguage.toLowerCase();
    const businessKeywords = [
      'revenue', 'sales', 'customer', 'order', 'product', 'performance',
      'analysis', 'trend', 'growth', 'profit', 'cost', 'inventory',
      'retention', 'acquisition', 'segmentation', 'conversion'
    ];

    // Boost score for business-relevant keywords
    const matchedKeywords = businessKeywords.filter(keyword => nl.includes(keyword));
    score += matchedKeywords.length * 5;

    // Check for analytical complexity
    if (example.queryPattern.complexity === 'complex') {
      score += 10;
    }

    // Check for practical use cases
    if (nl.includes('top') || nl.includes('best') || nl.includes('worst')) {
      score += 10; // Ranking queries are very useful
    }

    if (nl.includes('last') || nl.includes('recent') || nl.includes('month') || nl.includes('year')) {
      score += 8; // Time-based queries are common
    }

    // Check if it covers common business patterns
    if (example.category && ['analytics', 'complex_business', 'time_series'].includes(example.category)) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Detect quality issues in examples
   */
  private detectQualityIssues(example: any): string[] {
    const issues: string[] = [];
    const sql = example.sql.toLowerCase();
    const nl = example.naturalLanguage.toLowerCase();

    // Check for common issues
    if (example.explanation.length < 20) {
      issues.push('Explanation too brief');
    }

    if (example.qualityScore < 80) {
      issues.push('Low quality score assigned');
    }

    if (!example.tags || example.tags.length === 0) {
      issues.push('Missing tags');
    }

    if (!example.businessContext) {
      issues.push('Missing business context');
    }

    // SQL-specific issues
    if (sql.includes('select *') && !nl.includes('all')) {
      issues.push('SELECT * used without "all" in natural language');
    }

    if (sql.length > 500) {
      issues.push('SQL query is very long - consider simplification');
    }

    if (example.queryPattern.tables.length > 3) {
      issues.push('Query involves many tables - may be too complex for examples');
    }

    return issues;
  }

  /**
   * Generate recommendations for improvement
   */
  private generateRecommendations(example: any, result: ValidationResult): string[] {
    const recommendations: string[] = [];

    if (result.syntaxErrors.length > 0) {
      recommendations.push('Fix SQL syntax errors');
    }

    if (result.technicalQuality < 80) {
      recommendations.push('Improve SQL best practices (add LIMIT, use specific columns, proper JOINs)');
    }

    if (result.businessRelevance < 70) {
      recommendations.push('Enhance business relevance with more practical use case');
    }

    if (!example.sql.toLowerCase().includes('limit')) {
      recommendations.push('Add LIMIT clause to prevent large result sets');
    }

    if (example.explanation.length < 30) {
      recommendations.push('Expand explanation to be more descriptive');
    }

    if (!example.businessContext) {
      recommendations.push('Add business context to explain real-world usage');
    }

    return recommendations;
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(result: ValidationResult): number {
    let score = 0;

    // Base score from validity
    if (result.isValid) {
      score += 40;
    } else {
      score += Math.max(0, 40 - result.syntaxErrors.length * 10);
    }

    // Technical quality (30% weight)
    score += (result.technicalQuality * 0.3);

    // Business relevance (30% weight)
    score += (result.businessRelevance * 0.3);

    // Deduct for quality issues
    score -= result.qualityIssues.length * 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate comprehensive validation report
   */
  private generateValidationReport(results: ValidationResult[], examplesData: any): DatasetValidationReport {
    const validResults = results.filter(r => r.isValid);
    
    // Calculate distributions
    const categoryDistribution: Record<string, number> = {};
    const complexityDistribution: Record<string, number> = {};
    const patternCoverage: Record<string, number> = {};

    examplesData.examples.forEach((example: any) => {
      // Category distribution
      const category = example.category || 'uncategorized';
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;

      // Complexity distribution
      const complexity = example.queryPattern.complexity;
      complexityDistribution[complexity] = (complexityDistribution[complexity] || 0) + 1;

      // Pattern coverage
      const pattern = example.queryPattern.type;
      patternCoverage[pattern] = (patternCoverage[pattern] || 0) + 1;
    });

    // Extract business contexts
    const businessContexts = examplesData.examples
      .filter((ex: any) => ex.businessContext)
      .map((ex: any) => ex.businessContext);

    // Generate overall recommendations
    const recommendations: string[] = [];
    
    const validPercentage = (validResults.length / results.length) * 100;
    if (validPercentage < 90) {
      recommendations.push(`Improve SQL syntax - only ${validPercentage.toFixed(1)}% of examples are syntactically valid`);
    }

    const avgQuality = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    if (avgQuality < 85) {
      recommendations.push(`Enhance overall quality - current average is ${avgQuality.toFixed(1)}/100`);
    }

    if (Object.keys(patternCoverage).length < 6) {
      recommendations.push('Add more diverse query patterns for better coverage');
    }

    if (results.filter(r => r.businessRelevance > 80).length < results.length * 0.7) {
      recommendations.push('Increase business relevance of examples');
    }

    return {
      totalExamples: results.length,
      validExamples: validResults.length,
      invalidExamples: results.length - validResults.length,
      averageQuality: avgQuality,
      categoryDistribution,
      complexityDistribution,
      patternCoverage,
      businessContextCoverage: [...new Set(businessContexts)],
      recommendations,
      results
    };
  }

  /**
   * Create mock schema for validation
   */
  private createMockSchema(): SchemaInfo {
    return {
      tables: {
        customers: {
          columns: [
            { column_name: 'customer_id', data_type: 'integer', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'name', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'email', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES' },
            { column_name: 'city', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES' },
            { column_name: 'country', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES' },
            { column_name: 'assigned_rep_id', data_type: 'integer', is_primary_key: false, is_foreign_key: true, is_nullable: 'YES' }
          ],
          primaryKeys: ['customer_id'],
          foreignKeys: [{ column: 'assigned_rep_id', referencedTable: 'sales_reps', referencedColumn: 'rep_id' }]
        },
        orders: {
          columns: [
            { column_name: 'order_id', data_type: 'integer', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'customer_id', data_type: 'integer', is_primary_key: false, is_foreign_key: true, is_nullable: 'NO' },
            { column_name: 'order_date', data_type: 'date', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'total_amount', data_type: 'decimal', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' }
          ],
          primaryKeys: ['order_id'],
          foreignKeys: [{ column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }]
        },
        products: {
          columns: [
            { column_name: 'product_id', data_type: 'integer', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'name', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'price', data_type: 'decimal', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'category', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES' },
            { column_name: 'description', data_type: 'text', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES' },
            { column_name: 'stock_quantity', data_type: 'integer', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES' }
          ],
          primaryKeys: ['product_id'],
          foreignKeys: []
        },
        order_items: {
          columns: [
            { column_name: 'item_id', data_type: 'integer', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'order_id', data_type: 'integer', is_primary_key: false, is_foreign_key: true, is_nullable: 'NO' },
            { column_name: 'product_id', data_type: 'integer', is_primary_key: false, is_foreign_key: true, is_nullable: 'NO' },
            { column_name: 'quantity', data_type: 'integer', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'price', data_type: 'decimal', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' }
          ],
          primaryKeys: ['item_id'],
          foreignKeys: [
            { column: 'order_id', referencedTable: 'orders', referencedColumn: 'order_id' },
            { column: 'product_id', referencedTable: 'products', referencedColumn: 'product_id' }
          ]
        },
        sales_reps: {
          columns: [
            { column_name: 'rep_id', data_type: 'integer', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'rep_name', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' },
            { column_name: 'region', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO' }
          ],
          primaryKeys: ['rep_id'],
          foreignKeys: []
        }
      },
      relationships: [
        { table: 'orders', column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' },
        { table: 'order_items', column: 'order_id', referencedTable: 'orders', referencedColumn: 'order_id' },
        { table: 'order_items', column: 'product_id', referencedTable: 'products', referencedColumn: 'product_id' },
        { table: 'customers', column: 'assigned_rep_id', referencedTable: 'sales_reps', referencedColumn: 'rep_id' }
      ]
    };
  }

  /**
   * Helper methods for SQL analysis
   */
  private hasAggregateFunction(sql: string): boolean {
    const aggregateFunctions = ['count', 'sum', 'avg', 'max', 'min', 'group_concat'];
    return aggregateFunctions.some(func => sql.includes(func + '('));
  }

  private hasTableAliases(sql: string): boolean {
    // Simple check for table aliases (e.g., "customers c", "orders o")
    return /\b\w+\s+[a-z]\b/.test(sql);
  }

  /**
   * Save validation report to file
   */
  async saveValidationReport(report: DatasetValidationReport): Promise<void> {
    const reportPath = path.join(__dirname, '../../evaluation-results/example-dataset-validation.json');
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Validation report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Example Dataset Validation\n');
  
  const validator = new ExampleDatasetValidator();
  
  try {
    const report = await validator.validateDataset();
    await validator.saveValidationReport(report);
    
    console.log('\n✅ Validation completed successfully!');
    
    // Print summary recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ExampleDatasetValidator, ValidationResult, DatasetValidationReport };