#!/usr/bin/env ts-node

import { AdvancedPromptingStrategies, PromptStrategyEvaluator } from '../services/promptingStrategies';
import { QueryPatternRecognizer } from '../services/queryPatternRecognizer';
import { SchemaInfo } from '../services/database';
import { RankedExample } from '../services/exampleRepository';

/**
 * Demonstration script for advanced prompting strategies
 * Shows practical examples of different prompting techniques
 */

// Sample schema for demonstration
const demoSchema: SchemaInfo = {
  tables: {
    customers: {
      columns: [
        { table_name: 'customers', column_name: 'customer_id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 },
        { table_name: 'customers', column_name: 'name', data_type: 'VARCHAR(255)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 2 },
        { table_name: 'customers', column_name: 'email', data_type: 'VARCHAR(255)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 3 },
        { table_name: 'customers', column_name: 'city', data_type: 'VARCHAR(100)', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES', column_default: null, ordinal_position: 4 },
        { table_name: 'customers', column_name: 'country', data_type: 'VARCHAR(50)', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES', column_default: null, ordinal_position: 5 },
        { table_name: 'customers', column_name: 'created_at', data_type: 'TIMESTAMP', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 6 }
      ],
      primaryKeys: ['customer_id'],
      foreignKeys: [],
      indexes: [],
      rowCount: 1250000
    },
    orders: {
      columns: [
        { table_name: 'orders', column_name: 'order_id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 },
        { table_name: 'orders', column_name: 'customer_id', data_type: 'INTEGER', is_primary_key: false, is_foreign_key: true, is_nullable: 'NO', column_default: null, ordinal_position: 2 },
        { table_name: 'orders', column_name: 'order_date', data_type: 'TIMESTAMP', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 3 },
        { table_name: 'orders', column_name: 'total_amount', data_type: 'DECIMAL(10,2)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 4 },
        { table_name: 'orders', column_name: 'status', data_type: 'VARCHAR(50)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 5 }
      ],
      primaryKeys: ['order_id'],
      foreignKeys: [
        { column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }
      ],
      indexes: [],
      rowCount: 3750000
    },
    products: {
      columns: [
        { table_name: 'products', column_name: 'product_id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 },
        { table_name: 'products', column_name: 'name', data_type: 'VARCHAR(255)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 2 },
        { table_name: 'products', column_name: 'price', data_type: 'DECIMAL(10,2)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 3 },
        { table_name: 'products', column_name: 'category', data_type: 'VARCHAR(100)', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES', column_default: null, ordinal_position: 4 }
      ],
      primaryKeys: ['product_id'],
      foreignKeys: [],
      indexes: [],
      rowCount: 50000
    },
    order_items: {
      columns: [
        { table_name: 'order_items', column_name: 'order_item_id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 },
        { table_name: 'order_items', column_name: 'order_id', data_type: 'INTEGER', is_primary_key: false, is_foreign_key: true, is_nullable: 'NO', column_default: null, ordinal_position: 2 },
        { table_name: 'order_items', column_name: 'product_id', data_type: 'INTEGER', is_primary_key: false, is_foreign_key: true, is_nullable: 'NO', column_default: null, ordinal_position: 3 },
        { table_name: 'order_items', column_name: 'quantity', data_type: 'INTEGER', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 4 },
        { table_name: 'order_items', column_name: 'price', data_type: 'DECIMAL(10,2)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 5 }
      ],
      primaryKeys: ['order_item_id'],
      foreignKeys: [
        { column: 'order_id', referencedTable: 'orders', referencedColumn: 'order_id' },
        { column: 'product_id', referencedTable: 'products', referencedColumn: 'product_id' }
      ],
      indexes: [],
      rowCount: 12500000
    }
  },
  relationships: [
    { table: 'orders', column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' },
    { table: 'order_items', column: 'order_id', referencedTable: 'orders', referencedColumn: 'order_id' },
    { table: 'order_items', column: 'product_id', referencedTable: 'products', referencedColumn: 'product_id' }
  ]
};

// Sample examples for few-shot prompting
const demoExamples: RankedExample[] = [
  {
    id: 'demo1',
    naturalLanguage: 'show me all customers',
    sql: 'SELECT customer_id, name, email, city, country FROM customers ORDER BY name LIMIT 20;',
    explanation: 'Retrieves customer information with a reasonable limit and sorted by name',
    schemaContext: 'customers table',
    queryPattern: {
      type: 'select_all',
      complexity: 'simple',
      tables: ['customers'],
      operations: ['SELECT', 'ORDER BY', 'LIMIT'],
      keywords: ['show', 'all', 'customers']
    },
    qualityScore: 95,
    usageCount: 25,
    successRate: 98,
    tags: ['basic', 'select', 'customers'],
    createdAt: new Date(),
    updatedAt: new Date(),
    similarityScore: 0.95,
    relevanceScore: 0.9,
    finalScore: 0.92
  },
  {
    id: 'demo2',
    naturalLanguage: 'how many orders were placed last month',
    sql: `SELECT COUNT(*) as order_count 
          FROM orders 
          WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
            AND order_date < DATE_TRUNC('month', CURRENT_DATE);`,
    explanation: 'Counts orders from the previous calendar month using PostgreSQL date functions',
    schemaContext: 'orders table with order_date column',
    queryPattern: {
      type: 'count',
      complexity: 'medium',
      tables: ['orders'],
      operations: ['COUNT', 'WHERE', 'DATE_TRUNC'],
      keywords: ['how', 'many', 'orders', 'last', 'month']
    },
    qualityScore: 92,
    usageCount: 18,
    successRate: 95,
    tags: ['count', 'date', 'filter'],
    createdAt: new Date(),
    updatedAt: new Date(),
    similarityScore: 0.85,
    relevanceScore: 0.88,
    finalScore: 0.87
  },
  {
    id: 'demo3',
    naturalLanguage: 'top 5 customers by total revenue',
    sql: `SELECT c.customer_id, c.name, SUM(o.total_amount) as total_revenue
          FROM customers c 
          JOIN orders o ON c.customer_id = o.customer_id 
          GROUP BY c.customer_id, c.name 
          ORDER BY total_revenue DESC 
          LIMIT 5;`,
    explanation: 'Joins customers and orders to calculate total revenue per customer, showing top 5',
    schemaContext: 'customers and orders tables with foreign key relationship',
    queryPattern: {
      type: 'top_n',
      complexity: 'complex',
      tables: ['customers', 'orders'],
      operations: ['SELECT', 'JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'SUM'],
      keywords: ['top', '5', 'customers', 'total', 'revenue']
    },
    qualityScore: 88,
    usageCount: 12,
    successRate: 90,
    tags: ['top', 'revenue', 'join', 'aggregate'],
    createdAt: new Date(),
    updatedAt: new Date(),
    similarityScore: 0.8,
    relevanceScore: 0.85,
    finalScore: 0.82
  }
];

// Test queries with different complexity levels
const testQueries = [
  {
    query: 'list all products',
    complexity: 'simple' as const,
    description: 'Simple SELECT query'
  },
  {
    query: 'customers from New York who placed orders',
    complexity: 'medium' as const,
    description: 'JOIN query with filtering'
  },
  {
    query: 'monthly revenue trend for the last 6 months with comparison to previous year',
    complexity: 'complex' as const,
    description: 'Complex analytical query with time-series analysis'
  }
];

async function demonstratePromptingStrategies() {
  console.log('🚀 Advanced SQL Prompting Strategies Demonstration\n');
  console.log('=' .repeat(80));
  
  const patternRecognizer = new QueryPatternRecognizer();
  
  for (const testQuery of testQueries) {
    console.log(`\n📝 Query: "${testQuery.query}"`);
    console.log(`📊 Complexity: ${testQuery.complexity}`);
    console.log(`📋 Description: ${testQuery.description}`);
    console.log('-'.repeat(60));
    
    // Analyze query intent
    const intent = patternRecognizer.recognizeQuery(testQuery.query, demoSchema);
    console.log(`🎯 Detected Intent: ${intent.type} (confidence: ${(intent.confidence * 100).toFixed(1)}%)`);
    console.log(`🏷️  Entities: ${intent.entities.join(', ')}`);
    console.log(`⚙️  Operations: ${intent.operations.join(', ')}`);
    
    // Test different model types
    const modelTypes: Array<'specialized-sql' | 'general-code' | 'general-language'> = [
      'specialized-sql',
      'general-code', 
      'general-language'
    ];
    
    for (const modelType of modelTypes) {
      console.log(`\n🤖 Model Type: ${modelType.toUpperCase()}`);
      
      const config = {
        maxTokens: 500,
        budgetPerQuery: 0.01,
        prioritizeAccuracy: true,
        prioritizeSpeed: false,
        prioritizeCost: false
      };
      
      const promptResult = AdvancedPromptingStrategies.buildOptimizedPrompt(
        testQuery.query,
        demoSchema,
        demoExamples,
        intent,
        modelType,
        config
      );
      
      console.log(`📈 Strategies Applied: ${promptResult.strategies.join(', ')}`);
      console.log(`🌡️  Temperature: ${promptResult.parameters.temperature}`);
      console.log(`🎫 Max Tokens: ${promptResult.parameters.maxTokens}`);
      
      // Calculate expected performance
      const performance = AdvancedPromptingStrategies.calculateExpectedImprovement(
        promptResult.strategies,
        0.45, // Baseline accuracy
        intent.complexity
      );
      
      console.log(`📊 Expected Accuracy: ${(performance.expectedAccuracy * 100).toFixed(1)}%`);
      console.log(`💰 Cost Multiplier: ${performance.costMultiplier.toFixed(2)}x`);
      console.log(`📏 Confidence Range: ${(performance.confidenceInterval[0] * 100).toFixed(1)}% - ${(performance.confidenceInterval[1] * 100).toFixed(1)}%`);
      
      // Show prompt preview (first 200 characters)
      console.log(`\n📄 System Prompt Preview:`);
      console.log(`"${promptResult.systemPrompt.substring(0, 200)}..."`);
      
      console.log(`\n📄 User Prompt Preview:`);
      console.log(`"${promptResult.userPrompt.substring(0, 200)}..."`);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

async function demonstrateStrategyComparison() {
  console.log('\n🔬 Strategy Performance Comparison\n');
  console.log('=' .repeat(80));
  
  const evaluationQueries = [
    {
      query: 'show me all customers',
      expectedSQL: 'SELECT * FROM customers ORDER BY name LIMIT 20;',
      complexity: 'simple' as const
    },
    {
      query: 'customers with their order count',
      expectedSQL: 'SELECT c.name, COUNT(o.order_id) as order_count FROM customers c LEFT JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id, c.name;',
      complexity: 'medium' as const
    },
    {
      query: 'top products by revenue in each category',
      expectedSQL: 'SELECT category, name, revenue FROM (SELECT p.category, p.name, SUM(oi.quantity * oi.price) as revenue, ROW_NUMBER() OVER (PARTITION BY p.category ORDER BY SUM(oi.quantity * oi.price) DESC) as rn FROM products p JOIN order_items oi ON p.product_id = oi.product_id GROUP BY p.category, p.name) ranked WHERE rn = 1;',
      complexity: 'complex' as const
    }
  ];
  
  console.log('📊 Evaluating strategies across different model types...\n');
  
  const modelTypes: Array<'specialized-sql' | 'general-code' | 'general-language'> = [
    'specialized-sql',
    'general-code',
    'general-language'
  ];
  
  for (const modelType of modelTypes) {
    console.log(`🤖 Model Type: ${modelType.toUpperCase()}`);
    console.log('-'.repeat(40));
    
    try {
      const results = await PromptStrategyEvaluator.evaluateStrategies(
        evaluationQueries,
        demoSchema,
        modelType
      );
      
      // Sort by accuracy for better presentation
      results.sort((a, b) => b.accuracy - a.accuracy);
      
      console.log('| Strategy | Accuracy | Avg Latency | Cost Multiplier |');
      console.log('|----------|----------|-------------|-----------------|');
      
      results.forEach(result => {
        console.log(`| ${result.strategy.padEnd(8)} | ${(result.accuracy * 100).toFixed(1).padStart(6)}% | ${result.avgLatency.toFixed(0).padStart(9)}ms | ${result.costMultiplier.toFixed(2).padStart(13)}x |`);
      });
      
      // Find best strategy
      const bestStrategy = results[0];
      console.log(`\n🏆 Best Strategy: ${bestStrategy.strategy} (${(bestStrategy.accuracy * 100).toFixed(1)}% accuracy)`);
      
    } catch (error) {
      console.log(`❌ Error evaluating ${modelType}: ${error}`);
    }
    
    console.log('\n');
  }
}

async function demonstratePromptOptimization() {
  console.log('⚡ Prompt Optimization Demonstration\n');
  console.log('=' .repeat(80));
  
  const testQuery = 'customers who haven\'t placed orders in the last 3 months';
  const patternRecognizer = new QueryPatternRecognizer();
  const intent = patternRecognizer.recognizeQuery(testQuery, demoSchema);
  
  console.log(`📝 Query: "${testQuery}"`);
  console.log(`🎯 Intent: ${intent.type} (${intent.complexity})\n`);
  
  // Test different optimization priorities
  const optimizationConfigs = [
    {
      name: 'Accuracy-Focused',
      config: {
        maxTokens: 800,
        budgetPerQuery: 0.05,
        prioritizeAccuracy: true,
        prioritizeSpeed: false,
        prioritizeCost: false
      }
    },
    {
      name: 'Speed-Focused',
      config: {
        maxTokens: 200,
        budgetPerQuery: 0.005,
        prioritizeAccuracy: false,
        prioritizeSpeed: true,
        prioritizeCost: false
      }
    },
    {
      name: 'Cost-Focused',
      config: {
        maxTokens: 300,
        budgetPerQuery: 0.01,
        prioritizeAccuracy: false,
        prioritizeSpeed: false,
        prioritizeCost: true
      }
    },
    {
      name: 'Balanced',
      config: {
        maxTokens: 400,
        budgetPerQuery: 0.02,
        prioritizeAccuracy: true,
        prioritizeSpeed: true,
        prioritizeCost: true
      }
    }
  ];
  
  console.log('| Configuration | Strategies | Max Tokens | Temperature | Expected Accuracy |');
  console.log('|---------------|------------|------------|-------------|-------------------|');
  
  for (const { name, config } of optimizationConfigs) {
    const result = AdvancedPromptingStrategies.buildOptimizedPrompt(
      testQuery,
      demoSchema,
      demoExamples,
      intent,
      'general-code',
      config
    );
    
    const performance = AdvancedPromptingStrategies.calculateExpectedImprovement(
      result.strategies,
      0.45,
      intent.complexity
    );
    
    console.log(`| ${name.padEnd(13)} | ${result.strategies.join(',').padEnd(10)} | ${result.parameters.maxTokens.toString().padStart(8)} | ${result.parameters.temperature.toFixed(2).padStart(9)} | ${(performance.expectedAccuracy * 100).toFixed(1).padStart(15)}% |`);
  }
  
  console.log('\n💡 Key Insights:');
  console.log('- Accuracy-focused uses more strategies and tokens for better results');
  console.log('- Speed-focused minimizes token usage and complexity');
  console.log('- Cost-focused balances token usage with reasonable accuracy');
  console.log('- Balanced approach provides good trade-offs across all metrics');
}

async function main() {
  try {
    console.log('🎯 Advanced SQL Prompting Strategies Research Demonstration');
    console.log('📚 Based on findings from sql-prompting-research.md\n');
    
    await demonstratePromptingStrategies();
    await demonstrateStrategyComparison();
    await demonstratePromptOptimization();
    
    console.log('\n✅ Demonstration completed successfully!');
    console.log('\n📖 For detailed research findings, see: backend/docs/sql-prompting-research.md');
    console.log('🔧 For implementation details, see: backend/src/services/promptingStrategies.ts');
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error);
    process.exit(1);
  }
}

// Run demonstration if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runPromptingDemo };