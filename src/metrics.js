// Use this file to for all the code necessary to interact with Grafana
const os = require('os');
const config = require('./config.js');

class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.postRequests = 0;
    this.deleteRequests = 0;
    this.getRequests = 0;
    this.putRequests = 0;

    this.activeUsers = 0;

    this.successfulAuth = 0;
    this.failedAuth = 0;

    this.pizzasSold = 0;
    this.pizzaCreationFailures = 0;
    this.totalRevenue = 0;

    this.pizzaCreationLatencyArr = [];
    this.serviceEndpointLatencyArr = [];

    // This will periodically send metrics to Grafana
    // ${metricPrefix},source=${config.metrics.source},method=${httpMethod} ${metricName}=${metricValue}
    setInterval(() => {
      // http requests
      this.sendMetricToGrafana('request', 'all', 'total', this.totalRequests);
      this.sendMetricToGrafana('request', 'delete', 'total', this.deleteRequests);
      this.sendMetricToGrafana('request', 'post', 'total', this.postRequests);
      this.sendMetricToGrafana('request', 'get', 'total', this.getRequests);
      this.sendMetricToGrafana('request', 'put', 'total', this.putRequests);

      // active users
      this.sendMetricToGrafana('users', 'activeusers', 'current', this.activeUsers);

      // auth attempts
      this.sendMetricToGrafana('auth', 'successful', 'total', this.successfulAuth);
      this.sendMetricToGrafana('auth', 'failed', 'total', this.failedAuth);

      // system resources
      this.sendMetricToGrafana('resources', 'memory', 'current', this.getMemoryUsagePercentage());
      this.sendMetricToGrafana('resources', 'cpu', 'current', this.getCpuUsagePercentage());

      // pizzas ordered
      this.sendMetricToGrafana('purchase', 'sold', 'total', this.pizzasSold);
      this.sendMetricToGrafana('purchase', 'failed', 'total', this.pizzaCreationFailures);
      this.sendMetricToGrafana('purchase', 'revenue', 'total', this.totalRevenue);

      // Latency
      this.sendMetricToGrafana("latency", "pizzaCreation", 'current', this.average(this.pizzaCreationLatencyArr));
      this.pizzaCreationLatencyArr = []; // reset array after sending metrics
      this.sendMetricToGrafana("latency", "serviceEndpoint", 'current', this.average(this.serviceEndpointLatencyArr));
      this.serviceEndpointLatencyArr = []; // reset array after sending metrics

    }, 10000).unref();
  }

  incrementRequests() {
    this.totalRequests++;
  }

  incrementDeleteRequests() {
    this.deleteRequests++;
    this.incrementRequests();
  }

  incrementPostRequests() {
    this.postRequests++;
    this.incrementRequests();
  }

  incrementGetRequests() {
    this.getRequests++;
    this.incrementRequests();
  }

  incrementPutRequests() {
    this.putRequests++;
    this.incrementRequests();
  }

  incrementActiveUsers() {
    this.activeUsers++;
  }
  decrememtActiveUsers() {
    this.activeUsers--;
  }

  incrementSuccessfulAuths() {
    this.successfulAuth++;
  }

  incrementFailedAuths() {
    this.failedAuth++;
  }

  incrementPizzasSold() {
    this.pizzasSold++;
  }

  incrementPizzaCreationFailures() {
    this.pizzaCreationFailures++;
  }

  updateTotalRevenue(amountMoneyEarned) {
    this.totalRevenue = this.totalRevenue + amountMoneyEarned;
  }

  updatePizzaCreationLatency(newLatency) {
    this.pizzaCreationLatencyArr.push(newLatency);
  }

  updateServiceEndpointLatency(newLatency) {
    this.serviceEndpointLatencyArr.push(newLatency);
  }

  average(array) {
    if (array.length == 0) {
      return null;
    }
    return array.reduce((a, b) => a + b) / array.length;
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
  }

  sendMetricToGrafana(metricPrefix, httpMethod, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.metrics.source},method=${httpMethod} ${metricName}=${metricValue}`;

    fetch(`${config.metrics.url}`, {
      method: 'post',
      body: metric,
      headers: { Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}` },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

const metrics = new Metrics();
module.exports = metrics;
