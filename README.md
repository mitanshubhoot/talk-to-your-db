# Talk to your DB - AI-Powered Database Queries

Talk to your database in natural language! This project allows you to describe what you want to find in plain English, and the system generates precise SQL queries to retrieve the data.

## 🚀 Phase 1 - MVP Features

- ✅ **Natural Language to SQL**: Convert plain English questions into SQL queries
- ✅ **PostgreSQL Support**: Connect to PostgreSQL databases
- ✅ **Automatic Schema Discovery**: Automatically understand your database structure
- ✅ **AI-Powered Query Generation**: Uses OpenAI GPT-4 for intelligent SQL generation
- ✅ **Query Execution**: Execute generated queries and display results
- ✅ **SQL Preview**: See the generated SQL before execution
- ✅ **Query Explanation**: Get plain English explanations of generated queries
- ✅ **Confidence Scoring**: AI confidence levels for generated queries
- ✅ **Safety Checks**: Prevents destructive operations (only SELECT queries allowed)
- ✅ **Modern Web Interface**: Clean, responsive React UI with Material-UI

## 🏗️ Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│                     │    │                     │    │                     │
│   React Frontend    │◄──►│   Node.js Backend   │◄──►│   PostgreSQL DB     │
│                     │    │                     │    │                     │
│  - Material-UI      │    │  - Express.js       │    │  - Your Data        │
│  - Monaco Editor    │    │  - OpenAI API       │    │  - Sample Data      │
│  - Axios API        │    │  - Schema Discovery │    │  - Auto Discovery   │
│                     │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## 🆓 Free AI Providers Available

You no longer need paid OpenAI API access! The system now supports multiple **FREE** AI providers:

| Provider | Free Tier | Strengths | How to Get API Key |
|----------|-----------|-----------|-------------------|
| **Hugging Face** | 10,000 tokens/month | Large model selection, reliable | [Get Free API Key](https://huggingface.co/settings/tokens) |
| **Cohere** | 100K tokens/month | Excellent for text generation | [Get Free API Key](https://dashboard.cohere.ai/api-keys) |
| **Text2SQL.ai** | 50 queries/month | Specialized for SQL generation | [Get Free API Key](https://text2sql.ai/api) |
| **Rule-based Fallback** | Unlimited | Always available, basic queries | No API key needed |

The system automatically tries providers in order, with fallbacks if one fails. You can use one or multiple providers simultaneously!

## 🛠️ Technology Stack

### Backend
- **Node.js** + **Express.js** + **TypeScript**
- **PostgreSQL** database driver (`pg`)
- **Multiple AI Providers** - Free alternatives to OpenAI
- **Winston** for logging
- **Zod** for input validation

### Frontend
- **React 18** + **TypeScript**
- **Material-UI** for components
- **Monaco Editor** for SQL display
- **Axios** for API calls
- **Vite** for build tooling

### DevOps
- **Docker** + **Docker Compose**
- **PostgreSQL** for sample data
- Hot reload for development

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- At least one free AI API key (recommended: Hugging Face or Cohere)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd text-to-sql

# Install dependencies for both frontend and backend
npm run install:all
```

### 2. Environment Configuration
Create a `.env` file in the root directory with **at least one** of these free AI providers:

```bash
# 🆓 FREE AI PROVIDERS (Choose one or more)

# Option 1: Hugging Face (FREE - 10,000 tokens/month)
HUGGING_FACE_API_KEY=your_hugging_face_api_key_here

# Option 2: Cohere (FREE - 100K tokens/month)  
COHERE_API_KEY=your_cohere_api_key_here

# Option 3: Text2SQL.ai (FREE - 50 queries/month)
TEXT2SQL_API_KEY=your_text2sql_api_key_here

# Option 4: OpenAI (PAID - but most accurate)
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration (Optional - uses Docker PostgreSQL by default)
DATABASE_URL=postgresql://username:password@localhost:5432/your_database
```

**💡 Quick Start Recommendation**: Get a free Hugging Face API key - it takes 30 seconds and gives you 10,000 free requests per month!

### 3. Start with Docker (Recommended)
```bash
# Start all services (backend, frontend, database)
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432 (user: `postgres`, password: `password`)

### 5. Alternative: Manual Setup
```bash
# Terminal 1: Start backend
cd backend
npm install
npm run dev

# Terminal 2: Start frontend
cd frontend
npm install
npm run dev

# Terminal 3: Start PostgreSQL (if not using Docker)
# Use your preferred method to start PostgreSQL
```

## 🎯 Usage Examples

Once the application is running, try these example queries:

### Basic Queries
- "Show me all customers"
- "List all products"
- "What orders were placed today?"

### Complex Queries
- "Show me customers who have placed orders in the last 30 days"
- "What are the top 5 products by revenue?"
- "Find customers from California who ordered electronics"
- "Show me the average order value by month"

### Business Intelligence
- "Which customers have spent more than $500?"
- "What products are running low on stock?"
- "Show me sales trends by category"

## 📊 Sample Database Schema

The application includes a sample e-commerce database with:

- **customers** - Customer information (8 sample customers)
- **products** - Product catalog (10 sample products)
- **orders** - Order records (8 sample orders)
- **order_items** - Order line items (with relationships)

## 🔧 API Endpoints

### Text-to-SQL Endpoints
- `POST /api/text-to-sql/generate` - Generate SQL from natural language
- `POST /api/text-to-sql/execute` - Execute a SQL query
- `POST /api/text-to-sql/generate-and-execute` - Generate and execute in one step

### Database Endpoints
- `GET /api/database/schema` - Get database schema information
- `GET /api/database/test-connection` - Test database connectivity
- `GET /api/database/tables` - Get list of tables with basic info

## 🔒 Security Features

- **Read-only Operations**: Only SELECT queries are allowed
- **Input Validation**: All inputs are validated using Zod schemas
- **SQL Injection Prevention**: Parameterized queries and input sanitization
- **Query Timeouts**: Prevents long-running queries
- **Connection Pooling**: Efficient database connection management

## 🧪 Testing

Try these queries to test the system:

```bash
# Test database connection
curl http://localhost:3001/api/database/test-connection

# Generate SQL
curl -X POST http://localhost:3001/api/text-to-sql/generate \
  -H "Content-Type: application/json" \
  -d '{"query": "show me all customers"}'

# Generate and execute
curl -X POST http://localhost:3001/api/text-to-sql/generate-and-execute \
  -H "Content-Type: application/json" \
  -d '{"query": "show me customers from New York"}'
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check your `DATABASE_URL` environment variable
   - Ensure PostgreSQL is running
   - Verify connection credentials

2. **OpenAI API Errors**
   - Verify your `OPENAI_API_KEY` is valid
   - Check your OpenAI account has sufficient credits
   - Ensure API key has proper permissions

3. **Frontend Can't Connect to Backend**
   - Check backend is running on port 3001
   - Verify CORS settings allow frontend origin
   - Check network connectivity

### Development Tips

- **Hot Reload**: Both frontend and backend support hot reload
- **Logs**: Check Docker logs with `docker-compose logs -f`
- **Database Access**: Connect to PostgreSQL using any client on `localhost:5432`

## 🔄 What's Next (Phase 2+)

Phase 1 is complete! Coming in future phases:
- Multi-database support (MySQL, SQL Server)
- Advanced query optimization
- Query history and favorites
- User authentication
- Business context configuration
- Conversational query refinement

## 📝 Development Notes

### Project Structure
```
text-to-sql/
├── backend/              # Node.js API server
│   ├── src/
│   │   ├── services/     # Database & OpenAI services
│   │   ├── routes/       # API route handlers
│   │   └── index.ts      # Main server file
│   └── package.json
├── frontend/             # React application
│   ├── src/
│   │   ├── services/     # API client
│   │   ├── App.tsx       # Main component
│   │   └── main.tsx      # Entry point
│   └── package.json
├── database/             # Database setup
│   └── init.sql          # Sample schema
├── docker-compose.yml    # Docker services
└── README.md            # This file
```

### Key Design Decisions
- **TypeScript**: Used throughout for type safety
- **Monorepo**: Both frontend and backend in one repository
- **Docker**: Containerized for easy deployment
- **Material-UI**: Professional, accessible UI components
- **OpenAI GPT-4**: Most reliable for SQL generation

## 🤝 Contributing

This is Phase 1 of the Text-to-SQL project. Future phases will add more features and improvements.

## 📄 License

MIT License - feel free to use this project for learning and commercial purposes.

---

**🎉 Congratulations! You've successfully set up the Text-to-SQL MVP!**

Start asking your database questions in plain English and watch the magic happen! 🪄 