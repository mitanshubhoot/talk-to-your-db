#!/usr/bin/env ts-node

import { SQLAPIEvaluator, APIEvaluationResult } from '../services/apiEvaluator';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Starting SQL Generation API Evaluation...\n');
  
  const evaluator = new SQLAPIEvaluator();
  
  try {
    // Run comprehensive evaluation
    console.log('📊 Evaluating all available APIs...');
    const results = await evaluator.evaluateAllAPIs();
    
    // Generate comparison report
    console.log('📝 Generating comparison report...');
    const report = await evaluator.generateComparisonReport(results);
    
    // Save results to files
    const outputDir = path.join(__dirname, '../../evaluation-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save detailed JSON results
    const jsonPath = path.join(outputDir, 'api-evaluation-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`💾 Detailed results saved to: ${jsonPath}`);
    
    // Save markdown report
    const reportPath = path.join(outputDir, 'api-evaluation-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    // Display summary in console
    console.log('\n' + '='.repeat(80));
    console.log('📋 EVALUATION SUMMARY');
    console.log('='.repeat(80));
    
    results.forEach(result => {
      console.log(`\n🔍 ${result.apiName} (${result.model})`);
      console.log(`   Accuracy: ${result.accuracy.toFixed(1)}%`);
      console.log(`   Latency: ${result.averageLatency.toFixed(0)}ms`);
      console.log(`   Cost: $${result.costPerQuery.toFixed(4)}/query`);
      console.log(`   Reliability: ${result.reliability.toFixed(1)}%`);
      
      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.errors.length}`);
      }
    });
    
    // Find and display best options
    const workingResults = results.filter(r => r.testResults.length > 0);
    
    if (workingResults.length > 0) {
      const bestAccuracy = workingResults.reduce((prev, current) => 
        prev.accuracy > current.accuracy ? prev : current
      );
      
      const bestLatency = workingResults.reduce((prev, current) => 
        prev.averageLatency < current.averageLatency ? prev : current
      );
      
      const bestCost = workingResults.reduce((prev, current) => 
        prev.costPerQuery < current.costPerQuery ? prev : current
      );
      
      console.log('\n' + '='.repeat(80));
      console.log('🏆 TOP PERFORMERS');
      console.log('='.repeat(80));
      console.log(`🎯 Best Accuracy: ${bestAccuracy.apiName} (${bestAccuracy.accuracy.toFixed(1)}%)`);
      console.log(`⚡ Best Performance: ${bestLatency.apiName} (${bestLatency.averageLatency.toFixed(0)}ms)`);
      console.log(`💰 Most Cost-Effective: ${bestCost.apiName} ($${bestCost.costPerQuery.toFixed(4)}/query)`);
    }
    
    console.log('\n✅ Evaluation completed successfully!');
    console.log(`📁 Full results available in: ${outputDir}`);
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error);
    process.exit(1);
  }
}

// Run the evaluation if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runAPIEvaluation };