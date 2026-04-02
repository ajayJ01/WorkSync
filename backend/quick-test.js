console.log("🔧 Quick Server Fix...");

try {
  // Test basic server startup
  const fastify = require('fastify');
  const server = fastify({ logger: true });
  
  console.log("✅ Fastify loaded");
  
  // Test basic route
  server.get('/test', async (request, reply) => {
    return { status: 'Server is working!' };
  });
  
  const start = async () => {
    try {
      await server.listen({ port: 5000, host: '0.0.0.0' });
      console.log('🚀 Server running on http://localhost:5000');
    } catch (err) {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  };
  
  start();
  
} catch (error) {
  console.error('❌ Fatal error:', error.message);
  console.error('Stack:', error.stack);
}
