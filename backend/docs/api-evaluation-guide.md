# SQL Generation API Evaluation Guide

This guide explains how to use the API evaluation system to test and compare different SQL generation APIs for accuracy, performance, cost, and reliability.

## Overview

The API evaluation system tests multiple SQL generation APIs using a standardized set of test cases covering:
- Simple SELECT queries
- Aggregation queries (COUNT, AVG, SUM)
- JOIN operations
- Complex analytical queries
- Filtering and sorting

## Supported APIs

### 1. Hugging Face Inference API
- **Models Tested**: SQLCoder-7B, CodeT5+ 770M
- **Strengths**: Specialized SQL models, good accuracy
- **Cost**: ~$0.001 per query (free tier available)
- **Rate Limits**: 1000 requests/hour (free tier)

### 2. OpenAI GPT-3.5-turbo
- **Strengths**: High accuracy with proper prompting, fast responses
- **Cost**: ~$0.002 per query
- **Rate Limits**: 3500 requests/minute

### 3. Anthropic Claude
- **Model**: Claude-3-Haiku
- **Strengths**: Good reasoning capabilities
- **Cost**: ~$0.00025 per query
- **Rate Limits**: 1000 requests/minute

### 4. Google Gemini
- **Model**: Gemini-Pro
- **Strengths**: Good performance, competitive pricing
- **Cost**: ~$0.0005 per query
- **Rate Limits**: 60 requests/minute (free tier)

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the backend directory with your API keys:

```bash
# Optional: Add API keys for testing (evaluation works without them using mock data)
HUGGINGFACE_API_KEY=your_hf_token_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_API_KEY=your_google_key_here
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Run Evaluation

```bash
# Run the complete evaluation
npm run evaluate-apis

# Or run directly with ts-node
npx ts-node src/scripts/evaluateAPIs.ts
```

## Test Cases

The evaluation uses these standardized test cases:

| Natural Language | Expected SQL | Difficulty |
|------------------|--------------|------------|
| "show me all users" | `SELECT * FROM users` | Simple |
| "how many users are there" | `SELECT COUNT(*) FROM users` | Simple |
| "users created last month" | `SELECT * FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)` | Medium |
| "posts with their authors" | `SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.user_id = u.id` | Medium |
| "average salary by department" | `SELECT department, AVG(salary) FROM employees GROUP BY department` | Medium |
| "top 5 customers by total order value" | Complex JOIN with aggregation and sorting | Complex |

## Evaluation Metrics

### 1. Accuracy
- Percentage of correctly generated SQL queries
- Uses both exact matching and semantic equivalence
- Weighted by query complexity

### 2. Performance
- Average response latency in milliseconds
- Includes network overhead and processing time

### 3. Cost Analysis
- Cost per query in USD
- Based on token usage and API pricing
- Includes free tier considerations

### 4. Reliability
- Percentage of successful API calls
- Error rate and failure modes
- Rate limit compliance

### 5. Confidence Scoring
- Model-provided confidence scores where available
- Validation-based confidence assessment

## Output Files

The evaluation generates several output files in `backend/evaluation-results/`:

### 1. `api-evaluation-results.json`
Detailed JSON results including:
- Individual test case results
- Performance metrics
- Error logs
- Raw API responses

### 2. `api-evaluation-report.md`
Human-readable markdown report with:
- Executive summary
- Comparison table
- Detailed analysis per API
- Recommendations

## Interpreting Results

### Accuracy Scores
- **90%+**: Excellent - suitable for production
- **70-89%**: Good - suitable with human review
- **50-69%**: Moderate - needs improvement
- **<50%**: Poor - not recommended

### Latency Benchmarks
- **<1000ms**: Fast - good user experience
- **1000-3000ms**: Acceptable
- **>3000ms**: Slow - may impact UX

### Cost Considerations
- **<$0.001**: Very cost-effective
- **$0.001-$0.005**: Reasonable for production
- **>$0.005**: Expensive - consider usage patterns

## Customization

### Adding New Test Cases

Edit `backend/src/services/apiEvaluator.ts` and add to the `testCases` array:

```typescript
{
  naturalLanguage: "your natural language query",
  expectedSQL: "SELECT your_expected_sql FROM table",
  schema: "table_schema_definition",
  difficulty: 'simple' | 'medium' | 'complex'
}
```

### Adding New APIs

1. Implement the API client method in `SQLAPIEvaluator`
2. Add configuration in `backend/src/config/apiConfig.ts`
3. Update the `evaluateAllAPIs()` method

### Custom Evaluation Criteria

Modify the `evaluateSQL()` method to implement custom comparison logic:
- Semantic equivalence checking
- Performance-aware validation
- Domain-specific requirements

## Best Practices

### 1. API Key Management
- Use environment variables for API keys
- Rotate keys regularly
- Monitor usage and costs

### 2. Rate Limit Compliance
- Implement proper delays between requests
- Use exponential backoff for retries
- Monitor rate limit headers

### 3. Cost Optimization
- Start with free tiers for evaluation
- Use caching for repeated queries
- Implement query complexity-based routing

### 4. Accuracy Validation
- Regularly update test cases
- Include domain-specific examples
- Validate against real user queries

## Troubleshooting

### Common Issues

1. **API Key Errors**
   - Verify environment variables are set
   - Check API key permissions and quotas

2. **Rate Limit Exceeded**
   - Reduce concurrent requests
   - Implement proper delays
   - Consider upgrading API plans

3. **Low Accuracy Scores**
   - Review prompt engineering
   - Add more relevant examples
   - Consider model fine-tuning

4. **High Latency**
   - Check network connectivity
   - Consider geographic API endpoints
   - Implement request caching

### Debug Mode

Enable detailed logging by setting:

```bash
DEBUG=api-evaluator npm run evaluate-apis
```

## Integration with Existing System

The evaluation results can be used to:

1. **Select Best API**: Choose the optimal API based on your requirements
2. **Implement Fallbacks**: Use multiple APIs with automatic failover
3. **Cost Optimization**: Route queries based on complexity and cost
4. **Quality Monitoring**: Continuously monitor and improve accuracy

## Next Steps

After evaluation:

1. Review the generated report
2. Select the best API(s) for your use case
3. Implement the chosen API in your application
4. Set up monitoring and feedback collection
5. Plan for continuous improvement and re-evaluation