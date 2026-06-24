

const TARGET_URL = 'https://aethertarot.cn/';
const CONCURRENT_REQUESTS = 20;

async function runConcurrencyTest() {
  console.log(`Starting concurrency test against ${TARGET_URL}`);
  console.log(`Sending ${CONCURRENT_REQUESTS} concurrent requests...`);

  const startTime = Date.now();

  const requests = Array.from({ length: CONCURRENT_REQUESTS }).map(async (_, index) => {
    const reqStart = Date.now();
    try {
      const response = await fetch(TARGET_URL);
      const reqDuration = Date.now() - reqStart;
      
      return {
        id: index,
        status: response.status,
        success: response.ok,
        duration: reqDuration,
      };
    } catch (error) {
      return {
        id: index,
        status: 0,
        success: false,
        duration: Date.now() - reqStart,
        error: error.message,
      };
    }
  });

  const results = await Promise.all(requests);
  const totalDuration = Date.now() - startTime;

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const medianDuration = durations[Math.floor(durations.length / 2)];
  const maxDuration = durations[durations.length - 1];

  console.log('\n--- Concurrency Test Results ---');
  console.log(`Total Time: ${totalDuration}ms`);
  console.log(`Successful Requests: ${successful}`);
  console.log(`Failed Requests: ${failed}`);
  console.log(`Average Response Time: ${avgDuration.toFixed(2)}ms`);
  console.log(`Median Response Time: ${medianDuration}ms`);
  console.log(`Max Response Time: ${maxDuration}ms`);
  
  if (failed > 0) {
    console.error('⚠️ Some requests failed!');
    console.table(results.filter(r => !r.success));
    process.exit(1);
  } else {
    console.log('✅ All concurrent requests succeeded!');
  }
}

runConcurrencyTest();
