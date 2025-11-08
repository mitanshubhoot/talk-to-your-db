import { ExampleRepository, ExampleSelectionCriteria } from '../services/exampleRepository';
import { AdvancedPromptBuilder, PromptContext } from '../services/advancedPromptBuilder';
import { QueryPatternRecognizer, QueryComplexity } from '../services/queryPatternRecognizer';
import { SchemaInfo } from '../services/database';

interface ExampleSelectionTest {
  testName: string;
  userQuery: string;
  expectedPatterns: string[];
  expectedTables: string[];
  minExamples: number;
  maxExamples: number;
}

interface TestResult {
  testName: string;
  userQuery: string;
  selectedExamples: number;
  relevantExamples: number;
  averageSimilarity: number;
  averageRelevance: number;
  patternMatch: boolean;
  tableMatch: boolean;
  passed: boolean;
  issues: string[];
}

interface SelectionTestReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageRelevance: number;
  averageSimilarity: number;
  results: TestResult[];
  recommendations: string[];
}

class ExampleSelectionTester {
  private exampleRepository: ExampleRepository;
  private promptBuilder: AdvancedPromptBuilder;
  private patternRecognizer: QueryPatternRecognizer;
  private mockSchema: SchemaInfo;

  constructor() {
    this.exampleRepository = new ExampleRepository();
    this.patternRecognizer = new QueryPatternRecognizer();
    this.promptBuilder = new AdvancedPromptBuilder(this.exampleRepository, this.patternRecognizer);
    this.mockSchema = this.createMockSchema();
  }

  /**
   * Run comprehensive tests for example selection strategies
   */
  async runSelectionTests(): Promise<SelectionTestReport> {
    console.log('🧪 Starting Example Selection Strategy Tests\n');

    const tests: ExampleSelectionTest[] = [
      // Basic SELECT queries
      {
        testName: 'Basic Customer List',
        userQuery: 'show me all customers',
        expectedPatterns: ['select_all', 'select'],
        expectedTables: ['customers'],
        minExamples: 2,
        maxExamples: 4
      },
      {
        testName: 'Basic Product List',
        userQuery: 'list all products',
        expectedPatterns: ['select_all', 'select'],
        expectedTables: ['products'],
        minExamples: 2,
        maxExamples: 4
      },

      // Count/Aggregation queries
      {
        testName: 'Customer Count',
        userQuery: 'how many customers do we have',
        expectedPatterns: ['count', 'aggregate'],
        expectedTables: ['customers'],
        minExamples: 2,
        maxExamples: 3
      },
      {
        testName: 'Order Count',
        userQuery: 'count total orders',
        expectedPatterns: ['count', 'aggregate'],
        expectedTables: ['orders'],
        minExamples: 2,
        maxExamples: 3
      },

      // Filtering queries
      {
        testName: 'Location Filter',
        userQuery: 'customers from California',
        expectedPatterns: ['filter'],
        expectedTables: ['customers'],
        minExamples: 2,
        maxExamples: 4
      },
      {
        testName: 'Price Filter',
        userQuery: 'products under $50',
        expectedPatterns: ['filter'],
        expectedTables: ['products'],
        minExamples: 2,
        maxExamples: 4
      },
      {
        testName: 'Date Filter',
        userQuery: 'orders from last month',
        expectedPatterns: ['filter'],
        expectedTables: ['orders'],
        minExamples: 2,
        maxExamples: 4
      },

      // Join queries
      {
        testName: 'Customer Orders Join',
        userQuery: 'orders with customer details',
        expectedPatterns: ['join'],
        expectedTables: ['orders', 'customers'],
        minExamples: 2,
        maxExamples: 4
      },
      {
        testName: 'Product Sales Join',
        userQuery: 'products and their sales',
        expectedPatterns: ['join'],
        expectedTables: ['products', 'order_items'],
        minExamples: 2,
        maxExamples: 4
      },

      // Ranking/Top N queries
      {
        testName: 'Top Customers',
        userQuery: 'top 10 customers by orders',
        expectedPatterns: ['top_n', 'ranking'],
        expectedTables: ['customers', 'orders'],
        minExamples: 2,
        maxExamples: 4
      },
      {
        testName: 'Best Products',
        userQuery: 'best selling products',
        expectedPatterns: ['top_n', 'ranking'],
        expectedTables: ['products'],
        minExamples: 2,
        maxExamples: 4
      },

      // Aggregation queries
      {
        testName: 'Revenue by Month',
        userQuery: 'monthly revenue totals',
        expectedPatterns: ['aggregate'],
        expectedTables: ['orders'],
        minExamples: 2,
        maxExamples: 4
      },
      {
        testName: 'Average Order Value',
        userQuery: 'average order value per customer',
        expectedPatterns: ['aggregate'],
        expectedTables: ['customers', 'orders'],
        minExamples: 2,
        maxExamples: 4
      },

      // Analytics queries
      {
        testName: 'Customer Analysis',
        userQuery: 'inactive customers analysis',
        expectedPatterns: ['analytics'],
        expectedTables: ['customers', 'orders'],
        minExamples: 1,
        maxExamples: 3
      },
      {
        testName: 'Performance Analysis',
        userQuery: 'product performance metrics',
        expectedPatterns: ['analytics'],
        expectedTables: ['products'],
        minExamples: 1,
        maxExamples: 3
      },

      // Complex business queries
      {
        testName: 'Customer Segmentation',
        userQuery: 'customer segmentation by purchase behavior',
        expectedPatterns: ['analytics'],
        expectedTables: ['customers', 'orders'],
        minExamples: 1,
        maxExamples: 3
      },
      {
        testName: 'Seasonal Trends',
        userQuery: 'seasonal sales trends comparison',
        expectedPatterns: ['analytics'],
        expectedTables: ['orders'],
        minExamples: 1,
        maxExamples: 3
      },

      // Edge cases
      {
        testName: 'Vague Query',
        userQuery: 'show me data',
        expectedPatterns: [],
        expectedTables: [],
        minExamples: 1,
        maxExamples: 5
      },
      {
        testName: 'Complex Multi-table',
        userQuery: 'comprehensive sales report with customer and product details',
        expectedPatterns: ['analytics', 'join'],
        expectedTables: ['customers', 'orders', 'products'],
        minExamples: 2,
        maxExamples: 5
      }
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      console.log(`🔍 Testing: ${test.testName}`);
      const result = await this.runSingleTest(test);
      results.push(result);
      
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}: ${result.selectedExamples} examples, avg similarity: ${(result.averageSimilarity * 100).toFixed(1)}%`);
      
      if (!result.passed) {
        console.log(`   Issues: ${result.issues.join(', ')}`);
      }
    }

    return this.generateTestReport(results);
  }

  /**
   * Run a single example selection test
   */
  private async runSingleTest(test: ExampleSelectionTest): Promise<TestResult> {
    const criteria: ExampleSelectionCriteria = {
      userQuery: test.userQuery,
      schemaContext: this.mockSchema,
      maxExamples: test.maxExamples,
      minSimilarityScore: 0.1
    };

    const examples = this.exampleRepository.selectExamples(criteria);
    
    const result: TestResult = {
      testName: test.testName,
      userQuery: test.userQuery,
      selectedExamples: examples.length,
      relevantExamples: 0,
      averageSimilarity: 0,
      averageRelevance: 0,
      patternMatch: false,
      tableMatch: false,
      passed: false,
      issues: []
    };

    // Calculate metrics
    if (examples.length > 0) {
      result.averageSimilarity = examples.reduce((sum, ex) => sum + ex.similarityScore, 0) / examples.length;
      result.averageRelevance = examples.reduce((sum, ex) => sum + ex.relevanceScore, 0) / examples.length;
    }

    // Check pattern matching
    if (test.expectedPatterns.length > 0) {
      const hasExpectedPattern = examples.some(ex => 
        test.expectedPatterns.includes(ex.queryPattern.type)
      );
      result.patternMatch = hasExpectedPattern;
    } else {
      result.patternMatch = true; // No specific pattern expected
    }

    // Check table matching
    if (test.expectedTables.length > 0) {
      const hasExpectedTable = examples.some(ex => 
        test.expectedTables.some(table => ex.queryPattern.tables.includes(table))
      );
      result.tableMatch = hasExpectedTable;
    } else {
      result.tableMatch = true; // No specific table expected
    }

    // Count relevant examples
    result.relevantExamples = examples.filter(ex => 
      ex.similarityScore > 0.2 || ex.relevanceScore > 0.3
    ).length;

    // Determine if test passed
    const issues: string[] = [];

    if (examples.length < test.minExamples) {
      issues.push(`Too few examples: ${examples.length} < ${test.minExamples}`);
    }

    if (examples.length > test.maxExamples) {
      issues.push(`Too many examples: ${examples.length} > ${test.maxExamples}`);
    }

    if (!result.patternMatch && test.expectedPatterns.length > 0) {
      issues.push(`No matching patterns found: expected ${test.expectedPatterns.join(', ')}`);
    }

    if (!result.tableMatch && test.expectedTables.length > 0) {
      issues.push(`No matching tables found: expected ${test.expectedTables.join(', ')}`);
    }

    if (result.averageSimilarity < 0.15 && test.expectedPatterns.length > 0) {
      issues.push(`Low similarity score: ${(result.averageSimilarity * 100).toFixed(1)}%`);
    }

    if (result.relevantExamples === 0 && examples.length > 0) {
      issues.push('No relevant examples found');
    }

    result.issues = issues;
    result.passed = issues.length === 0;

    return result;
  }

  /**
   * Test prompt building with selected examples
   */
  async testPromptBuilding(): Promise<void> {
    console.log('\n🔧 Testing Prompt Building with Examples\n');

    const testQueries = [
      'show me all customers',
      'top 5 products by revenue',
      'customers who haven\'t ordered recently',
      'monthly sales trends'
    ];

    for (const query of testQueries) {
      console.log(`📝 Building prompt for: "${query}"`);
      
      try {
        const intent = await this.patternRecognizer.analyzeQuery(query, this.mockSchema);
        
        const context: PromptContext = {
          naturalLanguageQuery: query,
          schemaContext: this.mockSchema,
          databaseDialect: 'postgresql',
          queryIntent: intent,
          complexity: intent.complexity
        };

        const prompt = await this.promptBuilder.buildPrompt(context);
        
        console.log(`   ✅ Generated prompt with ${prompt.examples.length} examples`);
        console.log(`   📊 System prompt: ${prompt.systemPrompt.length} chars`);
        console.log(`   📊 User prompt: ${prompt.userPrompt.length} chars`);
        
        // Validate that examples are relevant
        const relevantExamples = prompt.examples.filter(ex => ex.similarityScore > 0.2);
        if (relevantExamples.length === 0 && prompt.examples.length > 0) {
          console.log(`   ⚠️  Warning: No highly relevant examples found`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error building prompt: ${error}`);
      }
    }
  }

  /**
   * Generate comprehensive test report
   */
  private generateTestReport(results: TestResult[]): SelectionTestReport {
    const passedTests = results.filter(r => r.passed);
    const failedTests = results.filter(r => !r.passed);

    const avgRelevance = results.reduce((sum, r) => sum + r.averageRelevance, 0) / results.length;
    const avgSimilarity = results.reduce((sum, r) => sum + r.averageSimilarity, 0) / results.length;

    // Generate recommendations
    const recommendations: string[] = [];

    if (failedTests.length > results.length * 0.2) {
      recommendations.push(`High failure rate: ${failedTests.length}/${results.length} tests failed`);
    }

    if (avgSimilarity < 0.3) {
      recommendations.push(`Low average similarity: ${(avgSimilarity * 100).toFixed(1)}% - improve keyword matching`);
    }

    if (avgRelevance < 0.4) {
      recommendations.push(`Low average relevance: ${(avgRelevance * 100).toFixed(1)}% - improve schema awareness`);
    }

    // Check for specific pattern issues
    const patternFailures = failedTests.filter(r => !r.patternMatch);
    if (patternFailures.length > 0) {
      recommendations.push(`Pattern matching issues in ${patternFailures.length} tests - add more diverse examples`);
    }

    const tableFailures = failedTests.filter(r => !r.tableMatch);
    if (tableFailures.length > 0) {
      recommendations.push(`Table matching issues in ${tableFailures.length} tests - improve table identification`);
    }

    return {
      totalTests: results.length,
      passedTests: passedTests.length,
      failedTests: failedTests.length,
      averageRelevance: avgRelevance,
      averageSimilarity: avgSimilarity,
      results,
      recommendations
    };
  }

  /**
   * Create mock schema for testing
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
            { column_name: 'country', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES' }
          ],
          primaryKeys: ['customer_id'],
          foreignKeys: []
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
            { column_name: 'category', data_type: 'varchar', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES' }
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
        }
      },
      relationships: [
        { table: 'orders', column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' },
        { table: 'order_items', column: 'order_id', referencedTable: 'orders', referencedColumn: 'order_id' },
        { table: 'order_items', column: 'product_id', referencedTable: 'products', referencedColumn: 'product_id' }
      ]
    };
  }

  /**
   * Save test report to file
   */
  async saveTestReport(report: SelectionTestReport): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    
    const reportPath = path.join(__dirname, '../../evaluation-results/example-selection-test-report.json');
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Test report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Example Selection Strategy Tests\n');
  
  const tester = new ExampleSelectionTester();
  
  try {
    // Run selection tests
    const report = await tester.runSelectionTests();
    
    // Test prompt building
    await tester.testPromptBuilding();
    
    // Save report
    await tester.saveTestReport(report);
    
    console.log('\n📊 Test Summary:');
    console.log(`   Total Tests: ${report.totalTests}`);
    console.log(`   Passed: ${report.passedTests} (${((report.passedTests/report.totalTests)*100).toFixed(1)}%)`);
    console.log(`   Failed: ${report.failedTests} (${((report.failedTests/report.totalTests)*100).toFixed(1)}%)`);
    console.log(`   Avg Similarity: ${(report.averageSimilarity * 100).toFixed(1)}%`);
    console.log(`   Avg Relevance: ${(report.averageRelevance * 100).toFixed(1)}%`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n✅ Example selection testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Testing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ExampleSelectionTester, TestResult, SelectionTestReport };